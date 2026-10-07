import { EntrySource, Prisma, StudentUnitType } from "@prisma/client";
import { PAYMENT_METHODS, readStoredPayments, type PaymentMethod } from "./payments";
import { prisma } from "./prisma";
import { SERVICE_TYPE_OPTIONS, serviceTypeWhere } from "./service-types";
import { getSpecialties } from "./specialties";
import { STUDENT_UNIT_LABELS } from "./student-units";
import { textOptions, type FilterDef, type SortDef } from "./list-filters";

type Where = Prisma.FinanceEntryWhereInput;
type OrderBy = Prisma.FinanceEntryOrderByWithRelationInput[];

/** Vendas antigas (antes das formas de pagamento estruturadas) só têm as colunas por método. */
const LEGACY_METHOD_COLUMN: Partial<Record<PaymentMethod, "cash" | "pix" | "card" | "transfer">> = {
  Dinheiro: "cash",
  PIX: "pix",
  "Transferência Bancária (TED/DOC)": "transfer",
  "Cartão de Débito": "card",
  "Cartão de Crédito": "card"
};

function paymentMethodWhere(methods: string[]): Where {
  return {
    OR: methods.flatMap((method): Where[] => {
      const conditions: Where[] = [{ payments: { path: "$.forms[*].method", array_contains: method } }];
      const column = LEGACY_METHOD_COLUMN[method as PaymentMethod];
      if (column) conditions.push({ payments: { equals: Prisma.DbNull }, [column]: { gt: 0 } });
      return conditions;
    })
  };
}

export const FINANCE_SORT: SortDef<OrderBy> = {
  key: "ordem",
  label: "Ordenar por",
  group: "Organização",
  options: [
    { value: "", label: "Mais recentes primeiro", orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "asc" }] },
    { value: "antigas", label: "Mais antigas primeiro", orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
    { value: "maior", label: "Maior valor", orderBy: [{ total: "desc" }, { date: "desc" }, { id: "asc" }] },
    { value: "menor", label: "Menor valor", orderBy: [{ total: "asc" }, { date: "desc" }, { id: "asc" }] },
    { value: "paciente", label: "Paciente (A–Z)", orderBy: [{ patientName: "asc" }, { date: "desc" }, { id: "asc" }] }
  ]
};

/**
 * Filtros do painel de Vendas. Com `studentId` (mentorado/funcionário) as opções saem só dos
 * registros daquela clínica; sem ele (admin) saem de todos, e entram os filtros de Mentorado e Área.
 */
export async function getFinanceFilterDefs(scope: { studentId: string } | { admin: true }): Promise<FilterDef<Where>[]> {
  const isAdmin = "admin" in scope;
  const base: Where = isAdmin ? {} : { studentId: scope.studentId };

  const distinct = async (field: "specialty" | "professional" | "closer") => {
    const rows = await prisma.financeEntry.findMany({
      where: { ...base, [field]: { not: null } },
      distinct: [field],
      select: { [field]: true }
    });
    return rows.map((row) => (row as Record<string, string | null>)[field]);
  };

  const [specialtiesUsed, specialtiesConfigured, professionals, closers, paymentRows, students] = await Promise.all([
    distinct("specialty"),
    isAdmin ? Promise.resolve([]) : getSpecialties(scope.studentId),
    distinct("professional"),
    distinct("closer"),
    prisma.financeEntry.findMany({
      where: { ...base, NOT: { payments: { equals: Prisma.DbNull } } },
      select: { payments: true }
    }),
    isAdmin ? prisma.student.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([])
  ]);

  const channels = paymentRows.flatMap((row) => (readStoredPayments(row.payments) ?? []).map((form) => form.channel));

  const defs: FilterDef<Where>[] = [];
  if (isAdmin) {
    defs.push(
      {
        kind: "multi",
        key: "mentorado",
        label: "Mentorado",
        group: "Mentorado",
        allLabel: "Todos",
        options: students.map((student) => ({ value: student.id, label: student.name })),
        where: (values) => ({ studentId: { in: values } })
      },
      {
        kind: "multi",
        key: "unidade",
        label: "Área",
        group: "Mentorado",
        allLabel: "Todas",
        options: Object.values(StudentUnitType).map((type) => ({ value: type, label: STUDENT_UNIT_LABELS[type] })),
        where: (values) => ({ unit: { type: { in: values as StudentUnitType[] } } })
      }
    );
  }
  defs.push(
    {
      kind: "multi",
      key: "tipo",
      label: "Tipo de atendimento",
      group: "Venda",
      allLabel: "Todos",
      options: SERVICE_TYPE_OPTIONS.map((value) => ({ value, label: value })),
      where: (values) => serviceTypeWhere(values as (typeof SERVICE_TYPE_OPTIONS)[number][])
    },
    {
      kind: "multi",
      key: "especialidade",
      label: "Especialidade",
      group: "Venda",
      allLabel: "Todas",
      options: textOptions(specialtiesConfigured, specialtiesUsed),
      where: (values) => ({ specialty: { in: values } })
    },
    {
      kind: "range",
      key: "valor",
      minKey: "valorMin",
      maxKey: "valorMax",
      label: "Valor total",
      group: "Venda",
      where: (min, max) => ({ total: { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) } })
    },
    {
      kind: "multi",
      key: "pagamento",
      label: "Forma de pagamento",
      group: "Pagamento",
      allLabel: "Todas",
      options: PAYMENT_METHODS.map((value) => ({ value, label: value })),
      where: paymentMethodWhere
    }
  );
  const channelOptions = textOptions(channels);
  if (channelOptions.length) {
    defs.push({
      kind: "multi",
      key: "canal",
      label: "Canal de recebimento",
      group: "Pagamento",
      allLabel: "Todos",
      options: channelOptions,
      where: (values) => ({ OR: values.map((value) => ({ payments: { path: "$.forms[*].channel", array_contains: value } })) })
    });
  }
  defs.push(
    {
      kind: "single",
      key: "estorno",
      label: "Estorno",
      group: "Pagamento",
      allLabel: "Todas",
      options: [
        { value: "com", label: "Só vendas com estorno" },
        { value: "sem", label: "Só vendas sem estorno" }
      ],
      where: ([value]) => (value === "com" ? { refundAmount: { gt: 0 } } : { refundAmount: { lte: 0 } })
    },
    {
      kind: "multi",
      key: "agendamento",
      label: "Responsável pelo agendamento",
      group: "Equipe",
      allLabel: "Todos",
      options: textOptions(professionals),
      where: (values) => ({ professional: { in: values } })
    },
    {
      kind: "multi",
      key: "fechamento",
      label: "Responsável pelo fechamento",
      group: "Equipe",
      allLabel: "Todos",
      options: textOptions(closers),
      where: (values) => ({ closer: { in: values } })
    },
    {
      kind: "single",
      key: "registro",
      label: "Como foi registrada",
      group: "Organização",
      allLabel: "Todas",
      options: [
        { value: "manual", label: "Registrada no portal" },
        { value: "importada", label: "Importada de planilha" }
      ],
      where: ([value]) => ({ source: value === "importada" ? EntrySource.IMPORT : EntrySource.MANUAL })
    }
  );
  return defs;
}
