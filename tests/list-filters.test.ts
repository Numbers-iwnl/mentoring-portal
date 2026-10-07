import { describe, expect, it } from "vitest";
import { dateRangeChip, parseAmount, parseFilters, parseSort, textOptions, type FilterDef, type SortDef } from "../lib/list-filters";
import { joinMultiParam, parseMultiParam } from "../lib/multi-filter";
import { serviceTypeWhere } from "../lib/service-types";

type W = { test: string };

const defs: FilterDef<W>[] = [
  {
    kind: "multi",
    key: "origem",
    label: "Origem",
    group: "Contato",
    allLabel: "Todas",
    options: [
      { value: "Instagram", label: "Instagram" },
      { value: "Whatsapp", label: "Whatsapp" },
      { value: "__sem_origem__", label: "Sem origem" }
    ],
    where: (values) => ({ test: `origem:${values.join(",")}` })
  },
  {
    kind: "single",
    key: "estorno",
    label: "Estorno",
    group: "Pagamento",
    allLabel: "Todas",
    options: [
      { value: "com", label: "Com estorno" },
      { value: "sem", label: "Sem estorno" }
    ],
    where: ([value]) => ({ test: `estorno:${value}` })
  },
  {
    kind: "range",
    key: "valor",
    minKey: "valorMin",
    maxKey: "valorMax",
    label: "Valor total",
    group: "Venda",
    where: (min, max) => ({ test: `valor:${min}-${max}` })
  }
];

describe("parseMultiParam", () => {
  it("reads single values (old links), pipe-joined values and repeated params", () => {
    const allowed = ["A", "B", "C"] as const;
    expect(parseMultiParam("B", allowed)).toEqual(["B"]);
    expect(parseMultiParam("C|A", allowed)).toEqual(["A", "C"]);
    expect(parseMultiParam(["C", "B|A"], allowed)).toEqual(["A", "B", "C"]);
  });

  it("drops unknown values and duplicates", () => {
    expect(parseMultiParam("A|X|A|", ["A", "B"])).toEqual(["A"]);
    expect(parseMultiParam(undefined, ["A"])).toEqual([]);
    expect(joinMultiParam([])).toBeUndefined();
    expect(joinMultiParam(["A", "B"])).toBe("A|B");
  });
});

describe("parseAmount", () => {
  it("accepts dot and pt-BR decimals, rejects junk", () => {
    expect(parseAmount("1500")).toBe(1500);
    expect(parseAmount("1500.5")).toBe(1500.5);
    expect(parseAmount("1.500,50")).toBe(1500.5);
    expect(parseAmount("-3")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("")).toBeUndefined();
  });
});

describe("parseFilters", () => {
  it("returns nothing active when the URL has no filters", () => {
    const parsed = parseFilters(defs, { q: "x" });
    expect(parsed.where).toEqual([]);
    expect(parsed.count).toBe(0);
    expect(parsed.chips).toEqual([]);
  });

  it("builds conditions, carry params and chips for active filters", () => {
    const parsed = parseFilters(defs, { origem: "Whatsapp|__sem_origem__|Hack", estorno: "com", valorMin: "100", valorMax: "50" });
    expect(parsed.where).toEqual([{ test: "origem:Whatsapp,__sem_origem__" }, { test: "estorno:com" }, { test: "valor:50-100" }]);
    expect(parsed.params).toEqual({ origem: "Whatsapp|__sem_origem__", estorno: "com", valorMin: "50", valorMax: "100" });
    expect(parsed.count).toBe(3);
    expect(parsed.chips[0].label).toBe("Origem: Whatsapp, Sem origem");
    expect(parsed.chips[1].label).toBe("Estorno: Com estorno");
    // Intl usa espaço não separável depois de "R$".
    expect(parsed.chips[2].label).toMatch(/^Valor total: R\$\s50,00 a R\$\s100,00$/);
    expect(parsed.chips[2].keys).toEqual(["valorMin", "valorMax"]);
  });

  it("keeps a single-choice filter to one value", () => {
    expect(parseFilters(defs, { estorno: "com|sem" }).params.estorno).toBe("com");
  });
});

describe("parseSort", () => {
  const sort: SortDef<string> = {
    key: "ordem",
    label: "Ordenar por",
    group: "Organização",
    options: [
      { value: "", label: "Mais recentes", orderBy: "date-desc" },
      { value: "maior", label: "Maior valor", orderBy: "total-desc" }
    ]
  };

  it("falls back to the default order without a chip", () => {
    expect(parseSort(sort, { ordem: "whatever" })).toMatchObject({ value: "", orderBy: "date-desc", param: undefined, chip: undefined });
  });

  it("uses the chosen order and shows it as a chip", () => {
    expect(parseSort(sort, { ordem: "maior" })).toMatchObject({ orderBy: "total-desc", param: "maior", chip: { label: "Ordenar por: Maior valor" } });
  });
});

describe("helpers", () => {
  it("formats the date range chip", () => {
    expect(dateRangeChip({ from: "2026-09-01", to: "2026-09-15" })).toEqual({ label: "Datas: 01/09/2026 a 15/09/2026", keys: ["from", "to"] });
    expect(dateRangeChip(null)).toBeUndefined();
  });

  it("builds sorted, trimmed, de-duplicated options", () => {
    expect(textOptions(["Whatsapp", " Instagram "], [null, "", "Whatsapp", "E-mail"]).map((option) => option.value)).toEqual([
      "E-mail",
      "Instagram",
      "Whatsapp"
    ]);
  });
});

describe("serviceTypeWhere", () => {
  it("does nothing without a selection", () => {
    expect(serviceTypeWhere([])).toEqual({});
  });

  it("matches the category and, for older sales without one, the keyword in the description", () => {
    const where = serviceTypeWhere(["Pilates"]);
    expect(JSON.stringify(where)).toContain('"serviceType":"Pilates"');
    expect(JSON.stringify(where)).toContain('"contains":"pilates"');
  });

  it("puts older sales that match no keyword under Outros", () => {
    const text = JSON.stringify(serviceTypeWhere(["Outros"]));
    expect(text).toContain('"serviceType":"Outros"');
    for (const keyword of ["fisio", "pilates", "recovery"]) expect(text).toContain(`"contains":"${keyword}"`);
  });
});
