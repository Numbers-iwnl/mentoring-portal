import { serviceTypeDisplay } from "@/lib/service-types";

/** Célula "Tipo de atendimento": categoria, ou o texto livre antigo (esmaecido) em vendas sem categoria. */
export function ServiceTypeCell({ serviceType, treatment }: { serviceType?: string | null; treatment?: string | null }) {
  const display = serviceTypeDisplay(serviceType, treatment);
  if (!display.legacy) return <td>{display.text}</td>;
  return (
    <td className="text-graphite-700/65" title="Venda registrada antes do campo de tipo de atendimento — mostrando a descrição">
      {display.text}
    </td>
  );
}
