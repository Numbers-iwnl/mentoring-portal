import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { importSpreadsheetBuffer } from "../lib/spreadsheet-import";

/**
 * Uso:
 *   IMPORT_WORKBOOK_PATH="C:/caminho/planilha.xlsx" IMPORT_STUDENT_ID="cli_xxx" npx tsx scripts/import-spreadsheet.ts
 *   IMPORT_YEAR=2026 (opcional; senão tenta extrair do nome do arquivo, senão usa o ano atual)
 *
 * Equivalente em linha de comando ao upload em Admin -> Importações (mesma lógica, lib/spreadsheet-import.ts).
 */

const workbookPath = process.env.IMPORT_WORKBOOK_PATH;
const studentId = process.env.IMPORT_STUDENT_ID;
const yearOverride = process.env.IMPORT_YEAR ? Number(process.env.IMPORT_YEAR) : undefined;

if (!workbookPath || !studentId) {
  console.error(
    'Uso: IMPORT_WORKBOOK_PATH="caminho/planilha.xlsx" IMPORT_STUDENT_ID="id_do_mentorado" npx tsx scripts/import-spreadsheet.ts'
  );
  process.exit(1);
}

async function main() {
  const buffer = await readFile(workbookPath!);
  const result = await importSpreadsheetBuffer({
    buffer,
    studentId: studentId!,
    sourceFile: workbookPath!,
    yearOverride
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
