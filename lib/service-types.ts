import type { Prisma } from "@prisma/client";

/** Categorias fixas de "Tipo de atendimento" da venda. A descrição livre fica em FinanceEntry.treatment. */
export const SERVICE_TYPE_OPTIONS = ["Fisioterapia", "Pilates", "Recovery", "Outros"] as const;

export type ServiceType = (typeof SERVICE_TYPE_OPTIONS)[number];

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === "string" && (SERVICE_TYPE_OPTIONS as readonly string[]).includes(value);
}

/**
 * O que mostrar na coluna "Tipo de atendimento" das listas. Vendas registradas antes de existir
 * a categoria só têm o texto livre antigo — nesses casos ele continua aparecendo (marcado como
 * legado) para a lista não ficar em branco.
 */
export function serviceTypeDisplay(serviceType: string | null | undefined, treatment: string | null | undefined) {
  if (serviceType) return { text: serviceType, legacy: false };
  if (treatment) return { text: treatment, legacy: true };
  return { text: "-", legacy: false };
}

/**
 * Palavra-chave usada para classificar, no filtro, as vendas antigas que ainda não têm categoria
 * (só o texto livre em treatment). Ex.: "Primeira consulta fisioterapia" entra em Fisioterapia.
 * As que não batem com nenhuma palavra entram em Outros.
 */
const LEGACY_KEYWORDS: Record<Exclude<ServiceType, "Outros">, string> = {
  Fisioterapia: "fisio",
  Pilates: "pilates",
  Recovery: "recovery"
};

const WITHOUT_CATEGORY: Prisma.FinanceEntryWhereInput = { OR: [{ serviceType: null }, { serviceType: "" }] };

/** Condição do filtro de Tipo de atendimento (vários tipos = qualquer um deles). Só leitura — não grava nada. */
export function serviceTypeWhere(types: readonly ServiceType[]): Prisma.FinanceEntryWhereInput {
  if (!types.length) return {};
  const conditions: Prisma.FinanceEntryWhereInput[] = types.map((type) => {
    if (type === "Outros") {
      return {
        OR: [
          { serviceType: "Outros" },
          {
            AND: [
              WITHOUT_CATEGORY,
              ...Object.values(LEGACY_KEYWORDS).map((keyword) => ({
                OR: [{ treatment: null }, { NOT: { treatment: { contains: keyword } } }]
              }))
            ]
          }
        ]
      };
    }
    return { OR: [{ serviceType: type }, { AND: [WITHOUT_CATEGORY, { treatment: { contains: LEGACY_KEYWORDS[type] } }] }] };
  });
  return { OR: conditions };
}
