"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { blockStaff } from "@/lib/guards";
import { importSpreadsheetBuffer, SpreadsheetImportError } from "@/lib/spreadsheet-import";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function uploadOwnSpreadsheetImport(formData: FormData) {
  const { user, studentId } = await blockStaff();
  if (!studentId) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) redirect("/app/importacoes?error=arquivo");
  if (!file.name.toLowerCase().endsWith(".xlsx")) redirect("/app/importacoes?error=formato");
  if (file.size > MAX_UPLOAD_BYTES) redirect("/app/importacoes?error=tamanho");

  let result: Awaited<ReturnType<typeof importSpreadsheetBuffer>>;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // studentId vem da sessão logada, nunca do formulário — um mentorado só importa para a própria conta.
    result = await importSpreadsheetBuffer({ buffer, studentId, sourceFile: file.name });
  } catch (error) {
    if (error instanceof SpreadsheetImportError) {
      redirect(`/app/importacoes?error=${error.code}`);
    }
    console.error("Falha ao importar planilha:", error);
    redirect("/app/importacoes?error=geral");
  }

  await writeAudit({
    userId: user.id,
    studentId,
    action: "import.spreadsheet",
    entity: "ImportBatch",
    entityId: result.batchId,
    metadata: { sourceFile: file.name, by: "student", ...result.summary }
  });

  revalidatePath("/app");
  revalidatePath("/app/financeiro");
  revalidatePath("/app/mensagens");

  const params = new URLSearchParams({
    imported: "1",
    financeImported: String(result.summary.financeImported),
    financeTotal: String(result.summary.financeTotal),
    financeWarnings: String(result.summary.financeWarnings),
    messagesImported: String(result.summary.messagesImported),
    messagesWarnings: String(result.summary.messagesWarnings)
  });
  redirect(`/app/importacoes?${params.toString()}`);
}
