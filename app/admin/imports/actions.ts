"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/guards";
import { importSpreadsheetBuffer, SpreadsheetImportError } from "@/lib/spreadsheet-import";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function uploadSpreadsheetImport(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") || "");
  const file = formData.get("file");

  if (!studentId) redirect("/admin/imports?error=mentorado");
  if (!(file instanceof File) || !file.size) redirect("/admin/imports?error=arquivo");
  if (!file.name.toLowerCase().endsWith(".xlsx")) redirect("/admin/imports?error=formato");
  if (file.size > MAX_UPLOAD_BYTES) redirect("/admin/imports?error=tamanho");

  let result: Awaited<ReturnType<typeof importSpreadsheetBuffer>>;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    result = await importSpreadsheetBuffer({ buffer, studentId, sourceFile: file.name });
  } catch (error) {
    if (error instanceof SpreadsheetImportError) {
      redirect(`/admin/imports?error=${error.code}`);
    }
    console.error("Falha ao importar planilha:", error);
    redirect("/admin/imports?error=geral");
  }

  await writeAudit({
    userId: admin.id,
    studentId: result.studentId,
    action: "import.spreadsheet",
    entity: "ImportBatch",
    entityId: result.batchId,
    metadata: { sourceFile: file.name, ...result.summary }
  });

  revalidatePath("/admin/imports");
  revalidatePath("/admin");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/messages");

  const params = new URLSearchParams({
    imported: "1",
    mentorado: result.studentName,
    financeImported: String(result.summary.financeImported),
    financeTotal: String(result.summary.financeTotal),
    financeWarnings: String(result.summary.financeWarnings),
    messagesImported: String(result.summary.messagesImported),
    messagesWarnings: String(result.summary.messagesWarnings)
  });
  redirect(`/admin/imports?${params.toString()}`);
}
