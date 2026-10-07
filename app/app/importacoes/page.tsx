import { redirect } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Toast } from "@/components/ui/toast";
import { formatCurrency, formatNumber } from "@/lib/format";
import { blockStaff } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { uploadOwnSpreadsheetImport } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  arquivo: "Selecione o arquivo .xlsx da planilha.",
  formato: "O arquivo precisa ser um .xlsx.",
  tamanho: "Arquivo grande demais (limite de 15 MB).",
  area: "Sua conta não tem uma área Clínica ativa — peça para o suporte ativar antes de importar.",
  planilha:
    'Não encontrei nenhuma aba "Financeiro - mês NN" ou "Mensagens - mês NN" nesse arquivo. Confirme se é a planilha padrão da Aurora.',
  geral: "Não foi possível importar essa planilha. Tente novamente ou peça ajuda ao suporte."
};

export default async function ImportacoesPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    imported?: string;
    financeImported?: string;
    financeTotal?: string;
    financeWarnings?: string;
    messagesImported?: string;
    messagesWarnings?: string;
  };
}) {
  const { studentId } = await blockStaff();
  if (!studentId) redirect("/login");

  const hasClinicUnit = await prisma.studentUnit.findFirst({
    where: { studentId, type: "CLINIC", active: true },
    select: { id: true }
  });

  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.geral : undefined;
  const financeWarnings = Number(searchParams?.financeWarnings || 0);
  const messagesWarnings = Number(searchParams?.messagesWarnings || 0);
  const totalWarnings = financeWarnings + messagesWarnings;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Importações</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Trazer a planilha antiga</h1>
        <p className="mt-2 max-w-2xl text-sm text-graphite-700/70">
          Já preenchia uma planilha antes de usar o portal? Envie o arquivo aqui para trazer as vendas e mensagens
          registradas para dentro do portal, sem precisar digitar tudo de novo.
        </p>
      </header>

      {errorMessage ? <Toast variant="error">{errorMessage}</Toast> : null}
      {searchParams?.imported ? (
        <Toast variant="success">
          <p>
            Planilha importada: {formatNumber(Number(searchParams.financeImported || 0))} venda(s) somando{" "}
            {formatCurrency(Number(searchParams.financeTotal || 0))}, {formatNumber(Number(searchParams.messagesImported || 0))}{" "}
            mensagem(ns).
          </p>
          {totalWarnings ? (
            <p className="mt-1 text-graphite-700/80">
              {formatNumber(totalWarnings)} linha(s) com algum aviso (ex.: total sem forma de pagamento correspondente) — os
              registros foram importados mesmo assim, revise-os em Vendas/Mensagens.
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
          {!hasClinicUnit ? (
            <p className="text-sm text-graphite-700/70">
              Sua conta ainda não tem uma área Clínica ativa — fale com o suporte Aurora para ativar antes de importar.
            </p>
          ) : (
            <form action={uploadOwnSpreadsheetImport} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
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
          )}
          <p className="mt-3 text-xs text-graphite-700/70">
            Pode importar o mesmo arquivo mais de uma vez sem medo — linhas já importadas antes não são duplicadas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
