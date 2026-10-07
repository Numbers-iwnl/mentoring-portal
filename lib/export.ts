import ExcelJS from "exceljs";

export type ExportColumnType = "text" | "number" | "currency" | "date";

export type ExportColumn = {
  header: string;
  key: string;
  type?: ExportColumnType;
  width?: number;
};

const CURRENCY_FORMAT = '"R$" #,##0.00';
const DATE_FORMAT = "dd/mm/yyyy";

function formatCsvValue(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  return String(value);
}

export function rowsToCsv(rows: Array<Record<string, unknown>>, columns?: ExportColumn[]) {
  const headers = columns?.map((column) => column.key) ?? (rows.length ? Object.keys(rows[0]) : []);
  const headerLabels = columns?.map((column) => column.header) ?? headers;
  if (!headers.length) return "";
  const escape = (value: unknown) => {
    const text = formatCsvValue(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headerLabels.join(";"), ...rows.map((row) => headers.map((header) => escape(row[header])).join(";"))].join("\n");
}

export async function rowsToXlsxBuffer(sheetName: string, rows: Array<Record<string, unknown>>, columns?: ExportColumn[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Aurora Mentoring";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);

  const resolvedColumns: ExportColumn[] =
    columns ?? (rows.length ? Object.keys(rows[0]).map((key) => ({ header: key, key })) : [{ header: "Sem dados", key: "empty" }]);

  sheet.columns = resolvedColumns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.max(14, Math.min(38, column.header.length + 6)),
    style:
      column.type === "currency"
        ? { numFmt: CURRENCY_FORMAT }
        : column.type === "date"
          ? { numFmt: DATE_FORMAT }
          : undefined
  }));
  sheet.addRows(rows);

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF11100D" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: resolvedColumns.length }
    };
  }
  return workbook.xlsx.writeBuffer();
}
