import type { ReactNode } from "react";
import { addDays, dayKey, money } from "../../config";

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" }) {
  return <div className="r3-kpi"><small>{label}</small><b>{value}</b>{sub && <span className={tone === "up" ? "r3-up" : tone === "down" ? "r3-down" : ""}>{sub}</span>}</div>;
}

export function Change({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <>sin período anterior para comparar</>;
  return <>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toLocaleString("es-AR")}% contra el período anterior</>;
}

/** Barras verticales simples (una por punto de la serie) */
export function Columns({ rows, format }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="r2-muted">Sin ventas en este período.</p>;
  return (
    <div className="r3-hours" role="img" aria-label="Gráfico de barras">
      {rows.map((r, i) => (
        <div key={i} title={`${r.label}: ${(format || money)(r.value)}`}><i style={{ height: `${Math.max(2, (r.value / max) * 100)}%` }} />{rows.length <= 16 && <span>{r.label}</span>}</div>
      ))}
    </div>
  );
}

export function Table({ heads, rows, num }: { heads: string[]; rows: ReactNode[][]; num?: number[] }) {
  return (
    <div className="r3-scroll"><table className="r3-table"><thead><tr>{heads.map((h, i) => <th key={i} className={num?.includes(i) ? "num" : ""}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={num?.includes(j) ? "num" : ""}>{c}</td>)}</tr>)}</tbody></table></div>
  );
}

export function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  return { from: dayKey(addDays(to, -(days - 1))), to: dayKey(to) };
}
