import { EntrySource, Prisma, StudentUnitType } from "@prisma/client";
import {
  APPROACH_OPTIONS,
  ATTENDED_OPTIONS,
  DISCARD_REASON_OTHER,
  DISCARD_STATUS_OPTIONS,
  MESSAGE_STATUS_OPTIONS
} from "./constants";
import { getOriginOptions, originFilterOptions, originWhere } from "./message-origins";
import { getPortalOptions } from "./portal-options";
import { prisma } from "./prisma";
import { STUDENT_UNIT_LABELS } from "./student-units";
import { textOptions, type FilterDef, type FilterOption, type SortDef } from "./list-filters";

type Where = Prisma.MessageEntryWhereInput;
type OrderBy = Prisma.MessageEntryOrderByWithRelationInput[];

const plain = (values: readonly string[]): FilterOption[] => values.map((value) => ({ value, label: value }));

/** Sim / Não / Em branco para os campos Sim-ou-Não opcionais. */
const YES_NO_BLANK: FilterOption[] = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "vazio", label: "Em branco" }
];

function yesNoWhere(field: "scheduled" | "bookedTreatment", values: string[]): Where {
  return {
    OR: values.map((value) => ({ [field]: value === "sim" ? true : value === "nao" ? false : null }))
  };
}

export const MESSAGE_SORT: SortDef<OrderBy> = {
  key: "ordem",
  label: "Ordenar por",
  group: "Organização",
  options: [
    { value: "", label: "Mais recentes primeiro", orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "asc" }] },
    { value: "antigas", label: "Mais antigas primeiro", orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
    { value: "nome", label: "Nome (A–Z)", orderBy: [{ name: "asc" }, { date: "desc" }, { id: "asc" }] }
  ]
};

/**
 * Filtros do painel de Mensagens. Com `studentId` (mentorado/funcionário) as opções saem só dos
 * contatos daquela clínica; sem ele (admin) saem de todos, e entram os filtros de Mentorado e Área.
 * Os parâmetros `status`, `discardStatus` e `origem` mantêm os nomes antigos (links já salvos continuam valendo).
 */
export async function getMessageFilterDefs(scope: { studentId: string } | { admin: true }): Promise<FilterDef<Where>[]> {
  const isAdmin = "admin" in scope;
  const base: Where = isAdmin ? {} : { studentId: scope.studentId };

  const distinct = async (field: "type" | "scheduledBy" | "professional" | "discardReason") => {
    const rows = await prisma.messageEntry.findMany({
      where: { ...base, [field]: { not: null } },
      distinct: [field],
      select: { [field]: true }
    });
    return rows.map((row) => (row as Record<string, string | null>)[field]);
  };

  const [typesConfigured, typesUsed, origins, reasonsConfigured, reasonsUsed, schedulers, closers, students] = await Promise.all([
    getPortalOptions("messageTypes"),
    distinct("type"),
    getOriginOptions(isAdmin ? undefined : scope.studentId),
    getPortalOptions("discardReasons"),
    distinct("discardReason"),
    distinct("scheduledBy"),
    distinct("professional"),
    isAdmin ? prisma.student.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([])
  ]);

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
  const discardReasons = textOptions(reasonsConfigured, reasonsUsed).filter((option) => option.value !== DISCARD_REASON_OTHER);
  defs.push(
    {
      kind: "multi",
      key: "origem",
      label: "Origem",
      group: "Contato",
      allLabel: "Todas",
      options: originFilterOptions(origins),
      where: originWhere
    },
    {
      kind: "multi",
      key: "tipo",
      label: "Tipo",
      group: "Contato",
      allLabel: "Todos",
      options: textOptions(typesConfigured, typesUsed),
      where: (values) => ({ type: { in: values } })
    },
    {
      kind: "multi",
      key: "agendou",
      label: "Agendou?",
      group: "Contato",
      allLabel: "Todos",
      options: YES_NO_BLANK,
      where: (values) => yesNoWhere("scheduled", values)
    },
    {
      kind: "single",
      key: "status",
      label: "Status",
      group: "Contato",
      allLabel: "Todos",
      options: plain(MESSAGE_STATUS_OPTIONS),
      where: ([value]) => ({ status: value })
    },
    {
      kind: "multi",
      key: "abordagem",
      label: "Abordagem",
      group: "Status do lead",
      allLabel: "Todas",
      options: plain(APPROACH_OPTIONS),
      where: (values) => ({ approach: { in: values } })
    },
    {
      kind: "multi",
      key: "atendeu",
      label: "Atendeu ou respondeu?",
      group: "Status do lead",
      allLabel: "Todos",
      options: plain(ATTENDED_OPTIONS),
      where: (values) => ({ attended: { in: values } })
    },
    {
      kind: "single",
      key: "discardStatus",
      label: "Descarte",
      group: "Status do lead",
      allLabel: "Todos",
      options: plain(DISCARD_STATUS_OPTIONS),
      where: ([value]) => ({ discardStatus: value })
    },
    {
      kind: "multi",
      key: "motivo",
      label: "Motivo de descarte",
      group: "Status do lead",
      allLabel: "Todos",
      options: [...discardReasons, { value: DISCARD_REASON_OTHER, label: DISCARD_REASON_OTHER }],
      where: (values) => ({ discardReason: { in: values } })
    },
    {
      kind: "multi",
      key: "tratamento",
      label: "Marcou tratamento?",
      group: "Status do lead",
      allLabel: "Todos",
      options: YES_NO_BLANK,
      where: (values) => yesNoWhere("bookedTreatment", values)
    },
    {
      kind: "multi",
      key: "agendamento",
      label: "Responsável pelo agendamento",
      group: "Equipe",
      allLabel: "Todos",
      options: textOptions(schedulers),
      where: (values) => ({ scheduledBy: { in: values } })
    },
    {
      kind: "multi",
      key: "fechamento",
      label: "Responsável pelo fechamento",
      group: "Equipe",
      allLabel: "Todos",
      options: textOptions(closers),
      where: (values) => ({ professional: { in: values } })
    },
    {
      kind: "single",
      key: "registro",
      label: "Como foi registrado",
      group: "Organização",
      allLabel: "Todos",
      options: [
        { value: "manual", label: "Registrado no portal" },
        { value: "importada", label: "Importado de planilha" }
      ],
      where: ([value]) => ({ source: value === "importada" ? EntrySource.IMPORT : EntrySource.MANUAL })
    }
  );
  return defs;
}
