import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/field";
import { requireAdmin } from "@/lib/guards";
import {
  getAllPortalOptions,
  MAX_PORTAL_OPTIONS,
  PORTAL_OPTION_LABELS,
  type PortalOptionKind
} from "@/lib/portal-options";
import { addPortalOption, removePortalOption, restorePortalOptionDefaults } from "./actions";
import { Toast } from "@/components/ui/toast";

const DESCRIPTIONS: Record<PortalOptionKind, string> = {
  installments: "Opções de parcelas disponíveis nas formas de pagamento da venda (cartão de crédito, boleto e cheque).",
  messageTypes: "Opções do campo Tipo no registro de mensagens.",
  channels: "Opções do campo Origem no registro de mensagens.",
  discardReasons: "Opções do campo Motivo de Descarte, mostrado quando o Descarte é \"Contato descartado\". \"Outro\" sempre aparece à parte, com campo de texto livre."
};

const PLACEHOLDERS: Record<PortalOptionKind, string> = {
  installments: "Ex.: 18x",
  messageTypes: "Ex.: Indicação",
  channels: "Ex.: TikTok",
  discardReasons: "Ex.: Horário"
};

export default async function SettingsPage({ searchParams }: { searchParams?: { saved?: string; error?: string } }) {
  await requireAdmin();
  const options = await getAllPortalOptions();
  const kinds = Object.keys(PORTAL_OPTION_LABELS) as PortalOptionKind[];

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne-700">Ajustes</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Opções do portal</h1>
        <p className="mt-2 max-w-2xl text-sm text-graphite-700/75">
          As listas abaixo alimentam os campos de seleção que os mentorados usam ao registrar vendas e mensagens. As alterações
          valem para todos e ficam registradas na Auditoria.
        </p>
      </header>

      {searchParams?.saved ? (
        <Toast variant="success">
          Opções atualizadas.
        </Toast>
      ) : null}
      {searchParams?.error === "ultima" ? (
        <Toast variant="error">
          A lista precisa manter pelo menos uma opção.
        </Toast>
      ) : null}
      {searchParams?.error === "limite" ? (
        <Toast variant="error">
          Limite de {MAX_PORTAL_OPTIONS} opções por lista atingido.
        </Toast>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {kinds.map((kind) => (
          <Card key={kind}>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{PORTAL_OPTION_LABELS[kind]}</CardTitle>
              <form action={restorePortalOptionDefaults}>
                <input type="hidden" name="kind" value={kind} />
                <ConfirmSubmitButton
                  message={`Restaurar a lista padrão de ${PORTAL_OPTION_LABELS[kind]}? As opções personalizadas serão substituídas.`}
                  variant="ghost"
                  className="h-8 px-2 text-xs text-graphite-700 hover:bg-graphite-950/5"
                >
                  <RotateCcw size={13} />
                  Restaurar padrão
                </ConfirmSubmitButton>
              </form>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-graphite-700/70">{DESCRIPTIONS[kind]}</p>
              <div className="flex flex-wrap gap-2">
                {options[kind].map((option) => (
                  <span
                    key={option}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-champagne-500/30 bg-champagne-100 py-1 pl-2.5 pr-1 text-sm font-semibold text-champagne-700"
                  >
                    {option}
                    <form action={removePortalOption} className="inline-flex">
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="option" value={option} />
                      <ConfirmSubmitButton
                        message={`Remover a opção "${option}"? Registros antigos que já usam esse valor não são alterados.`}
                        variant="ghost"
                        className="h-5 w-5 rounded-sm p-0 text-champagne-700/70 hover:bg-champagne-500/20 hover:text-champagne-700"
                        aria-label={`Remover ${option}`}
                      >
                        <X size={12} />
                      </ConfirmSubmitButton>
                    </form>
                  </span>
                ))}
              </div>
              <form action={addPortalOption} className="flex items-center gap-2">
                <input type="hidden" name="kind" value={kind} />
                <Input name="option" required maxLength={40} placeholder={PLACEHOLDERS[kind]} className="h-9 max-w-56 text-sm" />
                <Button type="submit" variant="secondary" className="h-9 px-3 text-xs">
                  <Plus size={14} />
                  Adicionar
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Status e agendamento</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-graphite-700">
            Os campos <strong>Status</strong> (Finalizado/Pendente) e <strong>Agendou?</strong> (Sim/Não) são fixos: o portal usa
            esses valores para calcular pendências, follow-up e taxa de conversão nos dashboards.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
