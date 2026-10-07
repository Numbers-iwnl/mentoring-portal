import path from "node:path";
import ExcelJS from "exceljs";
import { EntrySource, Prisma } from "@prisma/client";
import { APPROACH_OPTIONS, DISCARD_REASON_OTHER, DISCARD_STATUS_OPTIONS } from "./constants";
import { dateFromInput } from "./dates";
import { toNumber } from "./format";
import { legacyColumnsFromPayments, serializePayments, type PaymentForm, type PaymentMethod } from "./payments";
import { getPortalOptions, savePortalOptions } from "./portal-options";
import { prisma } from "./prisma";
import { getProfessionals, saveProfessionals } from "./professionals";
import { getSpecialties, saveSpecialties } from "./specialties";

/**
 * Importa planilhas de mentorados (abas "Financeiro - mês NN" e
 * "Mensagens - mês NN"). Cada aba é organizada em blocos repetidos por dia
 * (N linhas fixas + resumo do dia), então as linhas de dados são reconhecidas
 * pelo conteúdo (Nº/Dia numérico + Nome preenchido), não por um intervalo
 * fixo — isso pula automaticamente os blocos "Resumo do Dia" / "Total de
 * interações do dia" sem precisar mapear onde cada um cai.
 *
 * Suporta DOIS layouts de coluna, detectados automaticamente pelo cabeçalho
 * de cada aba (não precisa o mentorado dizer qual é):
 * - "official": o modelo padrão Aurora completo (Especialidade, Cartão de
 *   Crédito/Débito/Recorrente/Boleto separados).
 * - "simple": um modelo mais enxuto visto em planilhas reais de mentorados
 *   (sem Especialidade, um único campo "Cartão" combinado) — layout
 *   confirmado a partir de uma planilha real trazida por um mentorado.
 * Uma aba cujo cabeçalho não bate com nenhum dos dois formatos gera um aviso
 * "formato não reconhecido" em vez de silenciosamente não importar nada.
 *
 * Usado tanto pelo upload em Admin → Importações quanto pelo script CLI
 * (scripts/import-spreadsheet.ts).
 */

function cellRaw(cell: ExcelJS.Cell): string | number | Date | null | undefined {
  const raw = cell.value as unknown;
  if (raw && typeof raw === "object" && "result" in (raw as Record<string, unknown>)) {
    return (raw as { result: string | number | Date | null }).result;
  }
  if (raw && typeof raw === "object" && "text" in (raw as Record<string, unknown>)) {
    return (raw as { text: string }).text;
  }
  if (raw && typeof raw === "object" && "richText" in (raw as Record<string, unknown>)) {
    return (raw as { richText: Array<{ text: string }> }).richText.map((part) => part.text).join("");
  }
  return raw as string | number | Date | null | undefined;
}

function numberValue(cell: ExcelJS.Cell) {
  return toNumber(cellRaw(cell) as number | string | null | undefined);
}

function textValue(cell: ExcelJS.Cell) {
  const raw = cellRaw(cell);
  if (raw == null) return null;
  const text = String(raw).trim();
  return text || null;
}

function parseInstallments(raw: string | null) {
  if (!raw) return 1;
  const match = raw.match(/\d+/);
  return match ? Math.max(1, Number.parseInt(match[0], 10)) : 1;
}

function dateStringFor(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractYear(sourceFile: string, yearOverride?: number) {
  if (yearOverride) return yearOverride;
  const match = path.basename(sourceFile).match(/(20\d{2})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function sheetMonth(sheetName: string) {
  const match = sheetName.match(/m[êe]s\s*(\d{1,2})/i);
  if (!match) return null;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : null;
}

function normalizeAgainstList(raw: string, options: readonly string[]) {
  const normalized = raw.trim().toLocaleLowerCase("pt-BR");
  return options.find((option) => option.toLocaleLowerCase("pt-BR") === normalized) ?? null;
}

function normalizeHeaderText(raw: string | null) {
  return raw ? raw.trim().toLocaleLowerCase("pt-BR") : null;
}

type SheetLayout = "official" | "simple" | "empty" | "unknown";

/**
 * Os dois formatos não só usam colunas diferentes — o texto do cabeçalho
 * também difere ("Nome" na official, "Paciente" na simple) e, em Mensagens,
 * até a LINHA do cabeçalho é diferente (official tem uma linha de título a
 * menos antes do cabeçalho). Por isso cada formato é checado no seu próprio
 * lugar exato, em vez de uma única posição "âncora" compartilhada — os dois
 * lugares foram confirmados em planilhas reais (uma de cada formato).
 */
function detectFinanceLayout(sheet: ExcelJS.Worksheet): SheetLayout {
  const header = sheet.getRow(3);
  const simpleLabel = normalizeHeaderText(textValue(header.getCell(3))); // "Paciente"
  const officialLabel = normalizeHeaderText(textValue(header.getCell(4))); // "Nome"
  if (simpleLabel === "paciente") return "simple";
  if (officialLabel === "nome") return "official";
  const hasAnyHeader = textValue(header.getCell(3)) || textValue(header.getCell(4));
  return hasAnyHeader ? "unknown" : "empty";
}

function detectMessageLayout(sheet: ExcelJS.Worksheet): SheetLayout {
  const officialHeader = sheet.getRow(3);
  const officialLabel = normalizeHeaderText(textValue(officialHeader.getCell(4))); // "Nome" (cabeçalho oficial fica na linha 3)
  if (officialLabel === "nome") return "official";
  const simpleHeader = sheet.getRow(4);
  const simpleLabel = normalizeHeaderText(textValue(simpleHeader.getCell(3))); // "Nome" (cabeçalho simples fica na linha 4)
  if (simpleLabel === "nome") return "simple";
  const hasAnyHeader = textValue(officialHeader.getCell(4)) || textValue(simpleHeader.getCell(3));
  return hasAnyHeader ? "unknown" : "empty";
}

type RowWarning = { sheet: string; row: number; name: string | null; note: string };

export type FinanceSheetResult = {
  imported: number;
  total: number;
  warnings: RowWarning[];
  specialties: string[];
  professionals: string[];
};

export type MessageSheetResult = {
  imported: number;
  scheduled: number;
  notScheduled: number;
  warnings: RowWarning[];
  messageTypes: string[];
};

type ExtractedFinanceRow = {
  day: number;
  name: string;
  treatment: string | null;
  specialty: string | null;
  professional: string | null;
  closer: string | null;
  entryTotal: number;
  rawPayments: Array<{ method: PaymentMethod; amount: number; installments: number }>;
  extraWarning?: string;
};

/** Modelo padrão Aurora: Nº|(col2)|Dia|Paciente|Tratamento|Especialidade|Valor Total|Dinheiro|Pix|Boleto|Cartão Crédito|Parcelas|Débito|Recorrente|Parcelas|Transferência|Profissional|Responsável. */
function extractOfficialFinanceRow(row: ExcelJS.Row): ExtractedFinanceRow | null {
  const seq = numberValue(row.getCell(1));
  const day = numberValue(row.getCell(3));
  const name = textValue(row.getCell(4));
  if (!seq || !day || !name) return null;

  const rawPayments: ExtractedFinanceRow["rawPayments"] = [];
  const push = (method: PaymentMethod, amount: number, installments = 1) => {
    if (amount > 0) rawPayments.push({ method, amount, installments: Math.max(1, installments) });
  };

  const credito = numberValue(row.getCell(11));
  const recorrente = numberValue(row.getCell(14));
  push("Dinheiro", numberValue(row.getCell(8)));
  push("PIX", numberValue(row.getCell(9)));
  push("Boleto Bancário", numberValue(row.getCell(10)));
  // "Cartão Recorrente" não existe como forma de pagamento no app — mapeado para Cartão de
  // Crédito (cobrança recorrente no Brasil é, na prática, sempre via cartão de crédito).
  push(
    "Cartão de Crédito",
    credito + recorrente,
    credito > 0 ? parseInstallments(textValue(row.getCell(12))) : parseInstallments(textValue(row.getCell(15)))
  );
  push("Cartão de Débito", numberValue(row.getCell(13)));
  push("Transferência Bancária (TED/DOC)", numberValue(row.getCell(16)));

  return {
    day,
    name,
    treatment: textValue(row.getCell(5)),
    specialty: textValue(row.getCell(6)),
    professional: textValue(row.getCell(17)),
    closer: textValue(row.getCell(18)),
    entryTotal: numberValue(row.getCell(7)),
    rawPayments,
    extraWarning:
      credito > 0 && recorrente > 0
        ? "Cartão de Crédito e Cartão Recorrente preenchidos na mesma linha — somados em uma única forma Cartão de Crédito"
        : undefined
  };
}

/** Modelo enxuto visto em planilhas reais de mentorados: Nº|Dia|Paciente|Tratamento|Valor Total|Dinheiro|Pix|Cartão|Parcelas|Transferência|Profissional|Responsável — sem Especialidade e com um único campo "Cartão" combinado (mapeado para Cartão de Crédito). */
function extractSimpleFinanceRow(row: ExcelJS.Row): ExtractedFinanceRow | null {
  const seq = numberValue(row.getCell(1));
  const day = numberValue(row.getCell(2));
  const name = textValue(row.getCell(3));
  if (!seq || !day || !name) return null;

  const rawPayments: ExtractedFinanceRow["rawPayments"] = [];
  const push = (method: PaymentMethod, amount: number, installments = 1) => {
    if (amount > 0) rawPayments.push({ method, amount, installments: Math.max(1, installments) });
  };

  const cardInstallments = parseInstallments(textValue(row.getCell(9)));
  push("Dinheiro", numberValue(row.getCell(6)));
  push("PIX", numberValue(row.getCell(7)));
  push("Cartão de Crédito", numberValue(row.getCell(8)), cardInstallments);
  push("Transferência Bancária (TED/DOC)", numberValue(row.getCell(10)));

  return {
    day,
    name,
    treatment: textValue(row.getCell(4)),
    specialty: null,
    professional: textValue(row.getCell(11)),
    closer: textValue(row.getCell(12)),
    entryTotal: numberValue(row.getCell(5)),
    rawPayments
  };
}

async function importFinanceSheet(
  sheet: ExcelJS.Worksheet,
  studentId: string,
  unitId: string,
  year: number,
  month: number
): Promise<FinanceSheetResult> {
  let imported = 0;
  let total = 0;
  const warnings: RowWarning[] = [];
  const specialties = new Set<string>();
  const professionals = new Set<string>();

  const layout = detectFinanceLayout(sheet);
  if (layout === "empty") {
    return { imported, total, warnings, specialties: [], professionals: [] };
  }
  if (layout === "unknown") {
    warnings.push({
      sheet: sheet.name,
      row: 3,
      name: null,
      note: "Formato do cabeçalho não reconhecido — nenhuma linha desta aba foi importada. Fale com o suporte se essa planilha deveria ter sido lida."
    });
    return { imported, total, warnings, specialties: [], professionals: [] };
  }
  const extractRow = layout === "simple" ? extractSimpleFinanceRow : extractOfficialFinanceRow;

  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const extracted = extractRow(row);
    if (!extracted) continue;
    const { day, name, treatment, specialty, professional, closer, entryTotal, rawPayments, extraWarning } = extracted;
    if (specialty) specialties.add(specialty);
    if (professional) professionals.add(professional);
    if (extraWarning) warnings.push({ sheet: sheet.name, row: rowNumber, name, note: extraWarning });

    const firstDate = dateStringFor(year, month, day);
    const payments: PaymentForm[] = rawPayments.map((payment) => ({ ...payment, firstDate }));

    const paymentSum = payments.reduce((sum, item) => sum + item.amount, 0);
    if (entryTotal <= 0) {
      warnings.push({ sheet: sheet.name, row: rowNumber, name, note: "Faturamento zerado ou ausente" });
    } else if (Math.abs(entryTotal - paymentSum) > 0.009) {
      warnings.push({
        sheet: sheet.name,
        row: rowNumber,
        name,
        note: `Faturamento (${entryTotal}) não bate com a soma das formas de pagamento (${paymentSum})`
      });
    }
    if (payments.length > 2) {
      warnings.push({
        sheet: sheet.name,
        row: rowNumber,
        name,
        note: `${payments.length} formas de pagamento na mesma linha (acima do limite normal de 2 no formulário)`
      });
    }

    const legacy = legacyColumnsFromPayments(payments);
    const id = `import-${studentId}-${sheet.name}-${rowNumber}`.replace(/\s+/g, "-");
    await prisma.financeEntry.upsert({
      where: { id },
      update: {},
      create: {
        id,
        studentId,
        unitId,
        date: dateFromInput(firstDate),
        patientName: name,
        treatment,
        specialty,
        total: entryTotal,
        cash: legacy.cash,
        pix: legacy.pix,
        card: legacy.card,
        transfer: legacy.transfer,
        payments: serializePayments(payments),
        professional,
        closer,
        source: EntrySource.IMPORT,
        sourceSheet: sheet.name,
        sourceRow: rowNumber,
        importedAt: new Date()
      }
    });

    imported += 1;
    total += entryTotal;
  }

  return { imported, total, warnings, specialties: [...specialties], professionals: [...professionals] };
}

type ExtractedMessageRow = {
  day: number;
  name: string;
  contact: string | null;
  type: string | null;
  channel: string | null;
  quemAgendou: string | null;
  reason: string | null;
  scheduledRaw: string | null;
  approachRaw: string | null;
  attendedRaw: string | null;
  discardStatusRaw: string | null;
  discardReasonRaw: string | null;
  bookedTreatmentRaw: string | null;
  status: string | null;
  observationsRaw: string | null;
};

/** Modelo padrão Aurora: Nº|Dia|(col3)|Nome|Contato|Tipo|Canal|Quem agendou?|Motivo|Agendou?|Abordagem|Atendeu|Descarte|Motivo Descarte|Marcou Tratamento|Status|Observações. */
function extractOfficialMessageRow(row: ExcelJS.Row): ExtractedMessageRow | null {
  const day = numberValue(row.getCell(2));
  const name = textValue(row.getCell(4));
  if (!day || !name) return null;
  return {
    day,
    name,
    contact: textValue(row.getCell(5)),
    type: textValue(row.getCell(6)),
    channel: textValue(row.getCell(7)),
    quemAgendou: textValue(row.getCell(8)),
    reason: textValue(row.getCell(9)),
    scheduledRaw: textValue(row.getCell(10)),
    approachRaw: textValue(row.getCell(11)),
    attendedRaw: textValue(row.getCell(12)),
    discardStatusRaw: textValue(row.getCell(13)),
    discardReasonRaw: textValue(row.getCell(14)),
    bookedTreatmentRaw: textValue(row.getCell(15)),
    status: textValue(row.getCell(16)),
    observationsRaw: textValue(row.getCell(17))
  };
}

/** Modelo enxuto visto em planilhas reais de mentorados: Nº|Dia|Nome|Contato|Tipo|Canal|Quem agendou?|Motivo|Agendou?|Status|Observações — sem a seção "Status do lead" (Abordagem/Atendeu/Descarte/Marcou Tratamento ficam em branco, preenchíveis depois pela edição). */
function extractSimpleMessageRow(row: ExcelJS.Row): ExtractedMessageRow | null {
  const day = numberValue(row.getCell(2));
  const name = textValue(row.getCell(3));
  if (!day || !name) return null;
  return {
    day,
    name,
    contact: textValue(row.getCell(4)),
    type: textValue(row.getCell(5)),
    channel: textValue(row.getCell(6)),
    quemAgendou: textValue(row.getCell(7)),
    reason: textValue(row.getCell(8)),
    scheduledRaw: textValue(row.getCell(9)),
    approachRaw: null,
    attendedRaw: null,
    discardStatusRaw: null,
    discardReasonRaw: null,
    bookedTreatmentRaw: null,
    status: textValue(row.getCell(10)),
    observationsRaw: textValue(row.getCell(11))
  };
}

async function importMessageSheet(
  sheet: ExcelJS.Worksheet,
  studentId: string,
  unitId: string,
  year: number,
  month: number,
  discardReasonOptions: string[]
): Promise<MessageSheetResult> {
  let imported = 0;
  let scheduled = 0;
  let notScheduled = 0;
  const warnings: RowWarning[] = [];
  const messageTypes = new Set<string>();

  const layout = detectMessageLayout(sheet);
  if (layout === "empty") {
    return { imported, scheduled, notScheduled, warnings, messageTypes: [] };
  }
  if (layout === "unknown") {
    warnings.push({
      sheet: sheet.name,
      row: 4,
      name: null,
      note: "Formato do cabeçalho não reconhecido — nenhuma linha desta aba foi importada. Fale com o suporte se essa planilha deveria ter sido lida."
    });
    return { imported, scheduled, notScheduled, warnings, messageTypes: [] };
  }
  const extractRow = layout === "simple" ? extractSimpleMessageRow : extractOfficialMessageRow;

  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const extracted = extractRow(row);
    if (!extracted) continue;
    const { day, name } = extracted;
    if (name === "Total de interações do dia:") continue;

    const { type, quemAgendou, scheduledRaw, attendedRaw, approachRaw, discardStatusRaw, discardReasonRaw, bookedTreatmentRaw, status } =
      extracted;
    const scheduledBoolean = scheduledRaw === "Sim" ? true : scheduledRaw === "Não" ? false : null;
    const attended = attendedRaw === "Sim" || attendedRaw === "Não" ? attendedRaw : null;
    const approach = approachRaw ? normalizeAgainstList(approachRaw, APPROACH_OPTIONS) : null;
    const discardStatus = discardStatusRaw ? normalizeAgainstList(discardStatusRaw, DISCARD_STATUS_OPTIONS) : null;
    if (discardStatusRaw && !discardStatus) {
      warnings.push({ sheet: sheet.name, row: rowNumber, name, note: `Descarte "${discardStatusRaw}" não reconhecido, ignorado` });
    }

    let discardReason: string | null = null;
    let discardReasonOther: string | null = null;
    if (discardReasonRaw) {
      const matched = normalizeAgainstList(discardReasonRaw, discardReasonOptions);
      if (matched) {
        discardReason = matched;
      } else {
        discardReason = DISCARD_REASON_OTHER;
        discardReasonOther = discardReasonRaw;
      }
    }

    const bookedTreatment = bookedTreatmentRaw === "Sim" ? true : bookedTreatmentRaw === "Não" ? false : null;

    if (type) messageTypes.add(type);
    if (scheduledBoolean === true) scheduled += 1;
    if (scheduledBoolean === false) notScheduled += 1;

    const extraNotes: string[] = [];
    if (quemAgendou) extraNotes.push(`Agendado por: ${quemAgendou}`);
    const observations = [extracted.observationsRaw, ...extraNotes].filter(Boolean).join(" | ") || null;

    const id = `import-${studentId}-${sheet.name}-${rowNumber}`.replace(/\s+/g, "-");
    await prisma.messageEntry.upsert({
      where: { id },
      update: {},
      create: {
        id,
        studentId,
        unitId,
        date: dateFromInput(dateStringFor(year, month, day)),
        name,
        contact: extracted.contact,
        type,
        channel: extracted.channel,
        approach,
        reason: extracted.reason,
        scheduled: scheduledBoolean,
        attended,
        discardStatus,
        discardReason,
        discardReasonOther,
        bookedTreatment,
        status,
        observations,
        source: EntrySource.IMPORT,
        sourceSheet: sheet.name,
        sourceRow: rowNumber,
        importedAt: new Date()
      }
    });

    imported += 1;
  }

  return { imported, scheduled, notScheduled, warnings, messageTypes: [...messageTypes] };
}

export type SpreadsheetImportResult = {
  studentId: string;
  studentName: string;
  year: number;
  sheets: Record<string, FinanceSheetResult | MessageSheetResult>;
  seeded: { specialties: string[]; professionals: string[]; messageTypes: string[] };
  summary: {
    financeImported: number;
    financeTotal: number;
    financeWarnings: number;
    messagesImported: number;
    messagesScheduled: number;
    messagesWarnings: number;
  };
  batchId: string;
};

export type SpreadsheetImportErrorCode = "arquivo" | "mentorado" | "area" | "planilha";

export class SpreadsheetImportError extends Error {
  code: SpreadsheetImportErrorCode;
  constructor(code: SpreadsheetImportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function importSpreadsheetBuffer(params: {
  buffer: Buffer;
  studentId: string;
  sourceFile: string;
  sourceLabel?: string;
  yearOverride?: number;
}): Promise<SpreadsheetImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // Os tipos embutidos do exceljs esperam uma versão mais antiga (não-genérica) de Buffer
    // do que a instalada aqui — mesma coisa em runtime, só o checker que reclama.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(params.buffer as any);
  } catch {
    throw new SpreadsheetImportError("arquivo", "Não consegui abrir esse arquivo. Confirme se é um .xlsx válido.");
  }

  const student = await prisma.student.findUnique({ where: { id: params.studentId }, include: { units: true } });
  if (!student) {
    throw new SpreadsheetImportError("mentorado", "Mentorado não encontrado.");
  }
  const clinicUnit = student.units.find((unit) => unit.type === "CLINIC" && unit.active);
  if (!clinicUnit) {
    throw new SpreadsheetImportError("area", `${student.name} não tem uma área Clínica ativa — ative a área antes de importar.`);
  }

  const financeSheets = workbook.worksheets.filter((sheet) => /^financeiro/i.test(sheet.name));
  const messageSheets = workbook.worksheets.filter((sheet) => /^mensagens/i.test(sheet.name));
  if (!financeSheets.length && !messageSheets.length) {
    throw new SpreadsheetImportError(
      "planilha",
      'Não encontrei nenhuma aba "Financeiro - mês NN" ou "Mensagens - mês NN" nesse arquivo. Confirme se é a planilha padrão.'
    );
  }

  const year = extractYear(params.sourceFile, params.yearOverride);
  const discardReasonOptions = await getPortalOptions("discardReasons");

  const sheets: Record<string, FinanceSheetResult | MessageSheetResult> = {};
  const allSpecialties = new Set<string>();
  const allProfessionals = new Set<string>();
  const allMessageTypes = new Set<string>();
  const summary = {
    financeImported: 0,
    financeTotal: 0,
    financeWarnings: 0,
    messagesImported: 0,
    messagesScheduled: 0,
    messagesWarnings: 0
  };

  for (const sheet of financeSheets) {
    const month = sheetMonth(sheet.name);
    if (!month) continue;
    const result = await importFinanceSheet(sheet, student.id, clinicUnit.id, year, month);
    result.specialties.forEach((item) => allSpecialties.add(item));
    result.professionals.forEach((item) => allProfessionals.add(item));
    sheets[sheet.name] = result;
    summary.financeImported += result.imported;
    summary.financeTotal += result.total;
    summary.financeWarnings += result.warnings.length;
  }

  for (const sheet of messageSheets) {
    const month = sheetMonth(sheet.name);
    if (!month) continue;
    const result = await importMessageSheet(sheet, student.id, clinicUnit.id, year, month, discardReasonOptions);
    result.messageTypes.forEach((item) => allMessageTypes.add(item));
    sheets[sheet.name] = result;
    summary.messagesImported += result.imported;
    summary.messagesScheduled += result.scheduled;
    summary.messagesWarnings += result.warnings.length;
  }

  // Semeia as listas editáveis com os valores reais da planilha, para que edições futuras
  // pelos formulários já mostrem essas opções (e não fiquem só "presas" nos registros importados).
  if (allSpecialties.size) {
    const existing = await getSpecialties(student.id);
    await saveSpecialties(student.id, [...existing, ...allSpecialties]);
  }
  if (allProfessionals.size) {
    const existing = await getProfessionals(student.id);
    await saveProfessionals(student.id, [...existing, ...allProfessionals]);
  }
  if (allMessageTypes.size) {
    const existing = await getPortalOptions("messageTypes");
    await savePortalOptions("messageTypes", [...existing, ...allMessageTypes]);
  }

  const batch = await prisma.importBatch.create({
    data: {
      sourceFile: params.sourceFile,
      sourceLabel: params.sourceLabel ?? `Importação padrão — ${student.name}`,
      expectedTotals: {} as Prisma.InputJsonValue,
      result: JSON.parse(JSON.stringify(sheets)) as Prisma.InputJsonValue
    }
  });

  return {
    studentId: student.id,
    studentName: student.name,
    year,
    sheets,
    seeded: {
      specialties: [...allSpecialties],
      professionals: [...allProfessionals],
      messageTypes: [...allMessageTypes]
    },
    summary,
    batchId: batch.id
  };
}
