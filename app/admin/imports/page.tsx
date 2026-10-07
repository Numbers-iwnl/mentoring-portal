import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Toast } from "@/components/ui/toast";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { uploadSpreadsheetImport } from "./actions";

type SheetSummary = { name: string; text: string; warnings: number };

/** Resumo legível de um lote: uma linha por aba ("Financeiro - Mês 07: 62 vendas · R$ 76.150,00"). */
function summarizeBatch(result: unknown): SheetSummary[] {
  if (!result || typeof result !== "object" || Array.isArray(result)) return [];
  const rows: SheetSummary[] = [];
  for (const [name, value] of Object.entries(result as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const sheet = value as Record<string, unknown>;
    if (typeof sheet.imported !== "number") continue;
    const warnings = Array.isArray(sheet.warnings) ? sheet.warnings.length : 0;
    const parts: string[] = [];
    if (typeof sheet.scheduled === "number" || typeof sheet.notScheduled === "number") {
      parts.push(`${formatNumber(sheet.imported)} contatos`);
      if (typeof sheet.scheduled === "number") parts.push(`${formatNumber(sheet.scheduled)} agendaram`);
    } else {
      parts.push(`${formatNumber(sheet.imported)} vendas`);
      if (typeof sheet.total === "number") parts.push(formatCurrency(sheet.total));
    }
    rows.push({ name, text: parts.join(" · "), warnings });
  }
  return rows;
}

/** Só o nome do arquivo (alguns lotes antigos gravaram o caminho completo do computador). */
function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

const batchDate = (value: Date) =>
  value.toLocaleString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ERROR_MESSAGES: Record<string, string> = {
  mentorado: "Selecione o mentorado.",
  arquivo: "Selecione o arquivo .xlsx da planilha.",
  formato: "O arquivo precisa ser um .xlsx.",
  tamanho: "Arquivo grande demais (limite de 15 MB).",
  area: "Esse mentorado não tem uma área Clínica ativa — ative a área em Alunos antes de importar.",
  planilha:
    'Não encontrei nenhuma aba "Financeiro - mês NN" ou "Mensagens - mês NN" nesse arquivo. Confirme se é a planilha padrão da Aurora.',
  geral: "Não foi possível importar essa planilha. Tente novamente ou peça ajuda ao time técnico."
};

export default async function ImportsPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    imported?: string;
    mentorado?: string;
    financeImported?: string;
    financeTotal?: string;
    financeWarnings?: string;
    messagesImported?: string;
    messagesWarnings?: string;
  };
}) {
  await requireAdmin();
  const [imports, students] = await Promise.all([
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.student.findMany({
      where: { active: true, units: { some: { type: "CLINIC", active: true } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clinicName: true }
    })
  ]);

  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.geral : undefined;
  const financeWarnings = Number(searchParams?.financeWarnings || 0);
  const messagesWarnings = Number(searchParams?.messagesWarnings || 0);
  const totalWarnings = financeWarnings + messagesWarnings;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Importações</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Planilhas antigas</h1>
      </header>

      {errorMessage ? <Toast variant="error">{errorMessage}</Toast> : null}
      {searchParams?.imported ? (
        <Toast variant="success">
          <p>
            Planilha de <strong>{searchParams.mentorado}</strong> importada: {formatNumber(Number(searchParams.financeImported || 0))}{" "}
            venda(s) somando {formatCurrency(Number(searchParams.financeTotal || 0))}, {formatNumber(Number(searchParams.messagesImported || 0))}{" "}
            mensagem(ns).
          </p>
          {totalWarnings ? (
            <p className="mt-1 text-graphite-700/80">
              {formatNumber(totalWarnings)} linha(s) com algum aviso (ex.: total sem forma de pagamento correspondente) — veja o
              detalhe no lote abaixo. Os registros foram importados mesmo assim; revise-os em Vendas/Mensagens.
            </p>
          ) : null}
        </Toast>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud size={18} />
            Importar planilha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadSpreadsheetImport} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start">
            <Field label="Mentorado">
              <Select name="studentId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                    {student.clinicName && student.clinicName !== student.name ? ` · ${student.clinicName}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Arquivo (.xlsx)" hint="Modelo padrão: abas 'Financeiro - mês NN' e 'Mensagens - mês NN'.">
              <input
                name="file"
                type="file"
                accept=".xlsx"
                required
                className="flex h-11 w-full items-center rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-sm text-ink outline-none transition file:mr-3 file:h-8 file:rounded-md file:border-0 file:bg-graphite-950/[0.06] file:px-3 file:text-xs file:font-semibold file:text-graphite-800 focus:border-champagne-500 focus:ring-2 focus:ring-[rgba(152,178,196,0.24)]"
              />
            </Field>
            <Button type="submit" className="md:mt-[1.625rem]">
              <UploadCloud size={16} />
              Importar
            </Button>
          </form>
          {!students.length ? (
            <p className="mt-3 text-sm text-graphite-700/70">
              Nenhum mentorado com área Clínica ativa ainda — crie o mentorado e ative a área Clínica antes de importar.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-graphite-700/70">
            Linhas já importadas antes (mesma aba + mesma linha) não são duplicadas se você importar o mesmo arquivo de novo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lotes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {imports.map((batch) => (
              <div key={batch.id} className="rounded-md border border-graphite-950/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{batch.sourceLabel}</p>
                  <p className="text-xs text-graphite-700/70">{batchDate(batch.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-graphite-700/70" title={batch.sourceFile}>
                  {fileName(batch.sourceFile)}
                </p>
                {summarizeBatch(batch.result).length ? (
                  <ul className="mt-3 grid gap-1.5 text-sm">
                    {summarizeBatch(batch.result).map((sheet) => (
                      <li key={sheet.name} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-graphite-800">{sheet.name}:</span>
                        <span>{sheet.text}</span>
                        {sheet.warnings ? (
                          <span className="rounded-full bg-champagne-100 px-2 py-0.5 text-xs font-semibold text-champagne-700">
                            {sheet.warnings} {sheet.warnings === 1 ? "aviso" : "avisos"}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-graphite-700/70">Ver detalhes técnicos</summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-graphite-950 p-3 text-xs text-ivory">
                    {JSON.stringify(batch.result, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
            {!imports.length ? <p className="text-sm text-graphite-700/70">Nenhuma importação registrada ainda.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
