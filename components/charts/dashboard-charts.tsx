"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCurrency } from "@/lib/format";

const palette = ["#98b2c4", "#071018", "#607889", "#c7d8e4", "#33424b", "#7c95a6", "#0c1834"];

/** Tooltip escuro no padrão do design system (substitui a caixa branca padrão do Recharts). */
const tooltipProps = {
  contentStyle: {
    backgroundColor: "#0c1834",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 10,
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
    padding: "10px 14px"
  },
  labelStyle: { color: "#e6eef3", fontWeight: 600, fontSize: 12, marginBottom: 4 },
  itemStyle: { color: "#c7d8e4", fontSize: 12, padding: 0 }
} as const;

const axisTick = { fontSize: 11, fill: "#607889" } as const;

export function RevenueBarChart({ data }: { data: Array<{ month?: string; label?: string; value: number; count?: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18 }}>
          <defs>
            <linearGradient id="ice-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c1d3df" />
              <stop offset="100%" stopColor="#7d99ac" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 8" stroke="#e3ebf0" vertical={false} />
          <XAxis dataKey={(row) => row.label ?? row.month} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => `R$${Number(value) / 1000}k`} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            {...tooltipProps}
            cursor={{ fill: "rgba(152, 178, 196, 0.1)" }}
            formatter={(value, _name, item) => {
              const count = (item?.payload as { count?: number } | undefined)?.count;
              const formatted = formatCurrency(Number(value));
              return [count != null ? `${formatted} · ${count} ${count === 1 ? "venda" : "vendas"}` : formatted, "Vendas brutas"];
            }}
          />
          <Bar dataKey="value" fill="url(#ice-bar)" radius={[5, 5, 0, 0]} maxBarSize={64}>
            <LabelList
              dataKey="count"
              position="top"
              formatter={(count: number) => (count ? `${count} ${count === 1 ? "venda" : "vendas"}` : "")}
              style={{ fontSize: 11, fill: "#33424b", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentPieChart({ data }: { data: Array<{ method: string; value: number; count?: number }> }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="method"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2.5}
            cornerRadius={3}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.method} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          {/* Total do período no centro do donut */}
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 15, fontWeight: 700, fill: "#071018" }}>
            {formatCurrency(total)}
          </text>
          <text x="50%" y="55%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10, fontWeight: 600, fill: "#607889", letterSpacing: 1.4 }}>
            TOTAL
          </text>
          <Tooltip
            {...tooltipProps}
            formatter={(value, name, item) => {
              const count = (item?.payload as { count?: number } | undefined)?.count;
              const formatted = formatCurrency(Number(value));
              return [count != null ? `${formatted} · ${count} ${count === 1 ? "venda" : "vendas"}` : formatted, name];
            }}
          />
          <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MessageStatusChart({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical">
          <defs>
            <linearGradient id="ink-bar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0c1834" />
              <stop offset="100%" stopColor="#33424b" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 8" stroke="#e3ebf0" horizontal={false} />
          <XAxis type="number" tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={100} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipProps} cursor={{ fill: "rgba(152, 178, 196, 0.1)" }} formatter={(value) => [String(value), "Quantidade"]} />
          <Bar dataKey="value" fill="url(#ink-bar)" radius={[0, 5, 5, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
