import type { ClinicExpenseCategory, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { toNumber } from "./format";

export const CLINIC_EXPENSE_CATEGORY_LABELS: Record<ClinicExpenseCategory, string> = {
  EMPLOYEES: "Funcionários",
  THIRD_PARTY: "Contrato terceiros",
  STRUCTURE: "Estrutural",
  CONSUMPTION: "Consumo",
  VARIABLE: "Variáveis",
  INVESTMENT: "Investimentos"
};

export const FIXED_IDLE_DISCOUNT_PERCENT = 20;

export const CLINIC_EXPENSE_ITEMS: Array<{ category: ClinicExpenseCategory; label: string; sortOrder: number }> = [
  { category: "EMPLOYEES", label: "Folha de pagamento", sortOrder: 10 },
  { category: "EMPLOYEES", label: "Provisão de 13º e Férias", sortOrder: 20 },
  { category: "EMPLOYEES", label: "FGTS", sortOrder: 30 },
  { category: "EMPLOYEES", label: "INSS", sortOrder: 40 },
  { category: "EMPLOYEES", label: "Pró-labore", sortOrder: 50 },
  { category: "EMPLOYEES", label: "Diária faxina", sortOrder: 60 },
  { category: "EMPLOYEES", label: "Outros", sortOrder: 70 },
  { category: "THIRD_PARTY", label: "Sistema de segurança", sortOrder: 110 },
  { category: "THIRD_PARTY", label: "Software de agendamento", sortOrder: 120 },
  { category: "THIRD_PARTY", label: "Manutenção equipamentos", sortOrder: 130 },
  { category: "THIRD_PARTY", label: "Empresa de marketing/propaganda", sortOrder: 140 },
  { category: "THIRD_PARTY", label: "Contrato com revistas/jornal", sortOrder: 150 },
  { category: "THIRD_PARTY", label: "Outros", sortOrder: 160 },
  { category: "STRUCTURE", label: "Aluguel", sortOrder: 210 },
  { category: "STRUCTURE", label: "Condomínio", sortOrder: 220 },
  { category: "STRUCTURE", label: "IPTU", sortOrder: 230 },
  { category: "STRUCTURE", label: "Água", sortOrder: 240 },
  { category: "STRUCTURE", label: "Energia", sortOrder: 250 },
  { category: "STRUCTURE", label: "Internet e telefone", sortOrder: 260 },
  { category: "STRUCTURE", label: "Manutenção do espaço", sortOrder: 270 },
  { category: "STRUCTURE", label: "Alvará de funcionamento", sortOrder: 280 },
  { category: "STRUCTURE", label: "Taxa do Crefito de funcionamento", sortOrder: 290 },
  { category: "STRUCTURE", label: "Outros", sortOrder: 300 },
  { category: "CONSUMPTION", label: "Café, chá, água", sortOrder: 310 },
  { category: "CONSUMPTION", label: "Copos descartáveis", sortOrder: 320 },
  { category: "CONSUMPTION", label: "Lençol descartável", sortOrder: 330 },
  { category: "CONSUMPTION", label: "Luvas descartáveis e outros", sortOrder: 340 },
  { category: "CONSUMPTION", label: "Mercado - extra", sortOrder: 350 },
  { category: "CONSUMPTION", label: "Material de limpeza", sortOrder: 360 },
  { category: "CONSUMPTION", label: "Gastos com brindes", sortOrder: 370 },
  { category: "CONSUMPTION", label: "Outros", sortOrder: 380 },
  { category: "VARIABLE", label: "Impostos", sortOrder: 410 },
  { category: "VARIABLE", label: "Porcentagem da taxa do cartão (R$)", sortOrder: 420 },
  { category: "INVESTMENT", label: "Reforma do espaço", sortOrder: 510 },
  { category: "INVESTMENT", label: "Compra de equipamentos", sortOrder: 520 },
  { category: "INVESTMENT", label: "Cursos clínicos", sortOrder: 530 },
  { category: "INVESTMENT", label: "Mentorias de gestão", sortOrder: 540 },
  { category: "INVESTMENT", label: "Outros", sortOrder: 550 }
];

export const CLINIC_ROOM_DAYS = [
  { key: "monday", label: "2ª feira" },
  { key: "tuesday", label: "3ª feira" },
  { key: "wednesday", label: "4ª feira" },
  { key: "thursday", label: "5ª feira" },
  { key: "friday", label: "6ª feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" }
] as const;

const FIXED_CATEGORIES = new Set<ClinicExpenseCategory>(["EMPLOYEES", "THIRD_PARTY", "STRUCTURE", "CONSUMPTION"]);

type ClinicCostSettingView = {
  unitId: string;
  weeksPerMonth: number;
  idleDiscountPercent: number;
};

type ClinicExpenseItemView = {
  id: string;
  unitId: string;
  category: ClinicExpenseCategory;
  label: string;
  amount: number;
  sortOrder: number;
};

type ClinicRoomHourView = {
  id: string;
  unitId: string;
  roomName: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  sortOrder: number;
};

export type ClinicCostData = {
  setting: ClinicCostSettingView;
  expenseItems: ClinicExpenseItemView[];
  roomHours: ClinicRoomHourView[];
};

export type ClinicCostMetrics = {
  fixedExpenses: number;
  variableExpenses: number;
  operatingExpenses: number;
  investments: number;
  weeklyRoomHours: number;
  monthlyRoomHours: number;
  discountedHours: number;
  costPerHour: number;
};

const COST_SETTING_PREFIX = "clinic-costs:";
const ROOM_SORT_ORDERS = Array.from({ length: 10 }, (_, index) => index + 1);

export async function ensureClinicCostData(unitId: string) {
  const data = defaultClinicCostData(unitId);
  await prisma.appSetting.upsert({
    where: { key: costSettingKey(unitId) },
    update: {},
    create: {
      key: costSettingKey(unitId),
      value: serializeClinicCostData(data)
    }
  });
}

export async function getClinicCostData(unitId: string): Promise<ClinicCostData> {
  const stored = await prisma.appSetting.findUnique({
    where: { key: costSettingKey(unitId) },
    select: { value: true }
  });

  const storedData = readStoredClinicCostData(unitId, stored?.value);
  if (storedData) return storedData;

  const legacyData = await getLegacyClinicCostData(unitId);
  if (legacyData) return legacyData;

  return defaultClinicCostData(unitId);
}

export async function saveClinicCostForm(unitId: string, formData: FormData) {
  const current = await getClinicCostData(unitId);
  const next: ClinicCostData = {
    setting: {
      unitId,
      weeksPerMonth: parseCostNumber(formData.get("weeksPerMonth")) || 4,
      idleDiscountPercent: FIXED_IDLE_DISCOUNT_PERCENT
    },
    expenseItems: current.expenseItems.map((item) => ({
      ...item,
      unitId,
      amount: parseCostNumber(formData.get(`expense:${item.id}`))
    })),
    roomHours: current.roomHours.map((room) => ({
      ...room,
      unitId,
      roomName: String(formData.get(`room:${room.id}:name`) || room.roomName).trim().slice(0, 80) || room.roomName,
      ...Object.fromEntries(CLINIC_ROOM_DAYS.map((day) => [day.key, parseCostNumber(formData.get(`room:${room.id}:${day.key}`))]))
    }))
  };

  await prisma.appSetting.upsert({
    where: { key: costSettingKey(unitId) },
    update: { value: serializeClinicCostData(next) },
    create: {
      key: costSettingKey(unitId),
      value: serializeClinicCostData(next)
    }
  });

  return next;
}

export function calculateClinicCosts(data: ClinicCostData): ClinicCostMetrics {
  const fixedExpenses = data.expenseItems
    .filter((item) => FIXED_CATEGORIES.has(item.category))
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const variableExpenses = data.expenseItems
    .filter((item) => item.category === "VARIABLE")
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const investments = data.expenseItems
    .filter((item) => item.category === "INVESTMENT")
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const weeklyRoomHours = data.roomHours.reduce(
    (sum, room) => sum + CLINIC_ROOM_DAYS.reduce((daySum, day) => daySum + toNumber(room[day.key]), 0),
    0
  );
  const monthlyRoomHours = weeklyRoomHours * toNumber(data.setting.weeksPerMonth);
  const discountedHours = monthlyRoomHours * Math.max(0, 1 - FIXED_IDLE_DISCOUNT_PERCENT / 100);

  const operatingExpenses = fixedExpenses + variableExpenses;

  return {
    fixedExpenses,
    variableExpenses,
    operatingExpenses,
    investments,
    weeklyRoomHours,
    monthlyRoomHours,
    discountedHours,
    // Custo/hora considera todas as despesas operacionais (fixas + variáveis),
    // já que o portal apresenta esses valores como um único total mensal.
    costPerHour: discountedHours > 0 ? operatingExpenses / discountedHours : 0
  };
}

export function parseCostNumber(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

export function decimalInput(value: Prisma.Decimal | number | null | undefined) {
  const number = toNumber(value as never);
  return number ? String(Number(number.toFixed(2))) : "";
}

function costSettingKey(unitId: string) {
  return `${COST_SETTING_PREFIX}${unitId}`;
}

function defaultClinicCostData(unitId: string): ClinicCostData {
  return {
    setting: {
      unitId,
      weeksPerMonth: 4,
      idleDiscountPercent: FIXED_IDLE_DISCOUNT_PERCENT
    },
    expenseItems: CLINIC_EXPENSE_ITEMS.map((item) => ({
      id: `expense-${item.sortOrder}`,
      unitId,
      category: item.category,
      label: item.label,
      amount: 0,
      sortOrder: item.sortOrder
    })),
    roomHours: ROOM_SORT_ORDERS.map((sortOrder) => ({
      id: `room-${sortOrder}`,
      unitId,
      sortOrder,
      roomName: `Sala ${sortOrder}`,
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0
    }))
  };
}

async function getLegacyClinicCostData(unitId: string): Promise<ClinicCostData | null> {
  const [setting, expenseItems, roomHours] = await Promise.all([
    prisma.clinicCostSetting.findUnique({ where: { unitId } }),
    prisma.clinicExpenseItem.findMany({ where: { unitId }, orderBy: { sortOrder: "asc" } }),
    prisma.clinicRoomHour.findMany({ where: { unitId }, orderBy: { sortOrder: "asc" } })
  ]);

  if (!setting || !expenseItems.length || !roomHours.length) return null;

  return {
    setting: {
      unitId,
      weeksPerMonth: toNumber(setting.weeksPerMonth),
      idleDiscountPercent: FIXED_IDLE_DISCOUNT_PERCENT
    },
    expenseItems: expenseItems.map((item) => ({
      id: item.id,
      unitId,
      category: item.category,
      label: item.label,
      amount: toNumber(item.amount),
      sortOrder: item.sortOrder
    })),
    roomHours: roomHours.map((room) => ({
      id: room.id,
      unitId,
      roomName: room.roomName,
      monday: toNumber(room.monday),
      tuesday: toNumber(room.tuesday),
      wednesday: toNumber(room.wednesday),
      thursday: toNumber(room.thursday),
      friday: toNumber(room.friday),
      saturday: toNumber(room.saturday),
      sunday: toNumber(room.sunday),
      sortOrder: room.sortOrder
    }))
  };
}

function serializeClinicCostData(data: ClinicCostData): Prisma.InputJsonValue {
  return {
    version: 1,
    setting: {
      weeksPerMonth: toNumber(data.setting.weeksPerMonth),
      idleDiscountPercent: FIXED_IDLE_DISCOUNT_PERCENT
    },
    expenses: data.expenseItems.map((item) => ({
      sortOrder: item.sortOrder,
      amount: toNumber(item.amount)
    })),
    rooms: data.roomHours.map((room) => ({
      sortOrder: room.sortOrder,
      roomName: room.roomName,
      ...Object.fromEntries(CLINIC_ROOM_DAYS.map((day) => [day.key, toNumber(room[day.key])]))
    }))
  };
}

function readStoredClinicCostData(unitId: string, value: Prisma.JsonValue | undefined): ClinicCostData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const setting = raw.setting && typeof raw.setting === "object" && !Array.isArray(raw.setting) ? (raw.setting as Record<string, unknown>) : {};
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  const expenseBySortOrder = new Map<number, number>();
  const roomBySortOrder = new Map<number, Record<string, unknown>>();

  for (const expense of expenses) {
    if (!expense || typeof expense !== "object" || Array.isArray(expense)) continue;
    const item = expense as Record<string, unknown>;
    const sortOrder = numberFromJson(item.sortOrder);
    if (sortOrder) expenseBySortOrder.set(sortOrder, numberFromJson(item.amount));
  }

  for (const room of rooms) {
    if (!room || typeof room !== "object" || Array.isArray(room)) continue;
    const item = room as Record<string, unknown>;
    const sortOrder = numberFromJson(item.sortOrder);
    if (sortOrder) roomBySortOrder.set(sortOrder, item);
  }

  return {
    setting: {
      unitId,
      weeksPerMonth: numberFromJson(setting.weeksPerMonth) || 4,
      idleDiscountPercent: FIXED_IDLE_DISCOUNT_PERCENT
    },
    expenseItems: CLINIC_EXPENSE_ITEMS.map((item) => ({
      id: `expense-${item.sortOrder}`,
      unitId,
      category: item.category,
      label: item.label,
      amount: expenseBySortOrder.get(item.sortOrder) ?? 0,
      sortOrder: item.sortOrder
    })),
    roomHours: ROOM_SORT_ORDERS.map((sortOrder) => {
      const room = roomBySortOrder.get(sortOrder) ?? {};
      return {
        id: `room-${sortOrder}`,
        unitId,
        sortOrder,
        roomName: typeof room.roomName === "string" && room.roomName.trim() ? room.roomName.trim().slice(0, 80) : `Sala ${sortOrder}`,
        monday: numberFromJson(room.monday),
        tuesday: numberFromJson(room.tuesday),
        wednesday: numberFromJson(room.wednesday),
        thursday: numberFromJson(room.thursday),
        friday: numberFromJson(room.friday),
        saturday: numberFromJson(room.saturday),
        sunday: numberFromJson(room.sunday)
      };
    })
  };
}

function numberFromJson(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
