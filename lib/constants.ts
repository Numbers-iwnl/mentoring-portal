export const APP_NAME = "Aurora Mentoring";
export const TIME_ZONE = "America/Sao_Paulo";

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
] as const;

export const INSTALLMENT_OPTIONS = [
  "1x",
  "2x",
  "3x",
  "4x",
  "5x",
  "6x",
  "7x",
  "8x",
  "9x",
  "10x",
  "11x",
  "12x"
] as const;

export const MESSAGE_TYPE_OPTIONS = ["Ativo", "Passivo", "Remarcação"] as const;
export const CHANNEL_OPTIONS = ["Whatsapp", "Ligação", "Instagram", "E-mail", "Presencial"] as const;
export const SCHEDULED_OPTIONS = ["Sim", "Não"] as const;
export const MESSAGE_STATUS_OPTIONS = ["Finalizado", "Pendente"] as const;

// "Abordagem" é fixo (não editável em Ajustes, igual Status/Agendou/Descarte).
export const APPROACH_OPTIONS = ["Ligação", "WhatsApp", "Outro"] as const;
// "Atendeu ou respondeu?" tem uma terceira opção além de Sim/Não, então usa sua própria lista.
export const ATTENDED_OPTIONS = ["Sim", "Não", "Remarcou"] as const;

// "Descarte" é fixo (a lógica condicional do formulário depende dele, igual Status/Agendou).
export const DISCARD_STATUS_OPTIONS = ["Contato descartado", "Contato qualificado"] as const;
// "Motivo de Descarte" é editável em Ajustes; "Outro" é sempre adicionado à parte (não fica na lista editável).
export const DISCARD_REASON_OPTIONS = ["Valor", "Sem retorno", "Convênio", "Localização", "Especialidade", "Sem interesse"] as const;
export const DISCARD_REASON_OTHER = "Outro";

