import { money } from "../../config";
import { Pill } from "../ui";
import { BarList } from "../r3/kit";
import { Change, Columns, Kpi, Table } from "./Parts";

const n1 = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }));
const CLASS_LABEL: Record<string, string> = { ESTRELLA: "Estrella", CABALLO: "Caballo de batalla", PUZZLE: "Puzzle", PERRO: "A revisar" };
const LIGHT: Record<string, [string, string]> = { VERDE: ["green", "Bien"], AMBAR: ["orange", "Atención"], ROJO: ["red", "Alto"] };

export function Sales({ d }: { d: any }) {
  return (
    <div className="r3-page">
      <div className="r3-kpis">
        <Kpi label="Ventas" value={money(d.total_sales)} sub={<Change pct={d.previous.change_pct} />} tone={d.previous.change_pct === null ? undefined : d.previous.change_pct >= 0 ? "up" : "down"} />
        <Kpi label="Cuentas cobradas" value={d.orders} sub={`Antes: ${d.previous.orders}`} />
        <Kpi label="Cubiertos" value={d.covers} />
        <Kpi label="Propinas (aparte)" value={money(d.tips_total)} sub="No integran las ventas" />
      </div>
      <h3>Ventas por {d.group === "day" ? "día" : d.group === "week" ? "semana" : "mes"}</h3>
      <Columns rows={d.series.map((s: any) => ({ label: s.key.slice(5).split("-").reverse().join("/"), value: s.sales }))} />
      <div className="r3-grid">
        <div><h3>Por canal</h3><BarList rows={d.by_channel.map((c: any) => ({ label: c.label, value: c.sales, sub: `${c.orders} cuentas · ${n1(c.share_pct)}%` }))} format={money} /></div>
        <div><h3>Por medio de pago</h3><BarList rows={d.by_method.map((m: any) => ({ label: m.label, value: m.amount, sub: m.tips ? `Propinas: ${money(m.tips)}` : undefined }))} format={money} /></div>
      </div>
    </div>
  );
}

export function Ticket({ d }: { d: any }) {
  const rows = (list: any[]) => list.map((r) => [r.label + (r.hours ? ` (${r.hours})` : ""), r.orders, money(r.sales), money(r.avg_ticket), r.covers, money(r.per_cover)]);
  const heads = ["", "Cuentas", "Ventas", "Ticket promedio", "Cubiertos", "Por cubierto"];
  return (
    <div className="r3-page">
      <div className="r3-kpis"><Kpi label="Ticket promedio" value={money(d.avg_ticket)} /><Kpi label="Por cubierto" value={money(d.per_cover)} /><Kpi label="Cuentas" value={d.orders} /><Kpi label="Cubiertos" value={d.covers} /></div>
      <h3>Por franja horaria</h3><Table heads={heads} rows={rows(d.by_band)} num={[1, 2, 3, 4, 5]} />
      <h3>Por canal</h3><Table heads={heads} rows={rows(d.by_channel)} num={[1, 2, 3, 4, 5]} />
      {d.by_table.length > 0 && <><h3>Por mesa</h3><Table heads={heads} rows={rows(d.by_table.slice(0, 20))} num={[1, 2, 3, 4, 5]} /></>}
    </div>
  );
}

export function Products({ d }: { d: any }) {
  const costs = d.costs_visible;
  const items: any[] = d.items;
  return (
    <div className="r3-page">
      <div className="r3-kpis"><Kpi label="Platos vendidos" value={d.summary.qty} /><Kpi label="Productos distintos" value={d.summary.products} />
        {costs && d.summary.no_cost > 0 && <Kpi label="Sin costo cargado" value={d.summary.no_cost} sub="Cargá su receta para ver el margen" />}</div>
      {costs ? (
        <div className="r3-chips">{Object.entries(d.classes as Record<string, string>).map(([k, v]) => <span key={k} className={`r3-class r3-class-${k.toLowerCase()}`} title={v}>{CLASS_LABEL[k]}: {v.split(": ")[1]}</span>)}</div>
      ) : <div className="rs-note rs-note-info">Los costos y márgenes los ve solo el administrador.</div>}
      {items.length === 0 ? <p className="r2-muted">Sin ventas en este período.</p> : (
        <Table heads={costs ? ["Plato", "Categoría", "Vendidos", "Ventas", "Margen", "Food cost", "Clase"] : ["Plato", "Categoría", "Vendidos", "% del total", "Ventas"]}
          num={costs ? [2, 3, 4, 5] : [2, 3, 4]}
          rows={items.slice(0, 60).map((r) => costs
            ? [r.name, r.category || "—", n1(r.qty), money(r.revenue), r.margin === null ? "—" : `${money(r.margin)} (${n1(r.margin_pct)}%)`,
              r.food_cost_pct === null ? "—" : <>{n1(r.food_cost_pct)}% {r.light && <Pill tone={LIGHT[r.light]?.[0] || "gray"}>{LIGHT[r.light]?.[1]}</Pill>}</>,
              r.class ? <span className={`r3-class r3-class-${r.class.toLowerCase()}`}>{CLASS_LABEL[r.class]}</span> : <span className="r2-muted">sin costo</span>]
            : [r.name, r.category || "—", n1(r.qty), `${n1(r.share_pct)}%`, money(r.revenue)])} />
      )}
    </div>
  );
}

export function Peak({ d }: { d: any }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const cell = (dow: number, h: number) => d.cells.find((c: any) => c.dow === dow && c.hour === h)?.orders || 0;
  const rot = d.rotation;
  return (
    <div className="r3-page">
      <div className="r3-kpis">
        <Kpi label="Rotación de mesas" value={rot.per_table_per_day === null ? "—" : `${n1(rot.per_table_per_day)} por día`} sub={`${rot.tables} mesas · ${rot.salon_orders} cuentas de salón`} />
        <Kpi label="Permanencia promedio" value={rot.avg_stay_min === null ? "—" : `${rot.avg_stay_min} min`} />
      </div>
      {d.top.length > 0 && <><h3>Los momentos más cargados</h3>
        <BarList rows={d.top.map((c: any) => ({ label: `${d.dow_labels[c.dow]} ${String(c.hour).padStart(2, "0")}:00`, value: c.orders, sub: `${c.covers} cubiertos` }))} /></>}
      <h3>Mapa de calor (cuentas por día y hora)</h3>
      <div className="r3-scroll" style={{ padding: 12 }}>
        <div className="r3-heat" role="img" aria-label="Mapa de calor por día y hora">
          <span />{hours.map((h) => <span key={h}>{h % 3 === 0 ? h : ""}</span>)}
          {d.dow_labels.map((name: string, dow: number) => (
            <div key={name} style={{ display: "contents" }}><span>{name.slice(0, 3)}</span>
              {hours.map((h) => { const v = cell(dow, h); return <i key={h} title={`${name} ${h}:00 · ${v} cuentas`} style={{ opacity: v ? 0.2 + 0.8 * (v / Math.max(1, d.max_orders)) : 0.06 }} />; })}</div>))}
        </div>
      </div>
    </div>
  );
}

export function Waiters({ d }: { d: any }) {
  if (!d.items.length) return <p className="r2-muted">No hay cuentas de salón con mozo en este período.</p>;
  return (
    <div className="r3-page">
      <Table heads={["Mozo", "Cuentas", "Ventas", "Ticket", "Cubiertos", "Propinas", "Min. por mesa", "Anulaciones", "Descuentos"]} num={[1, 2, 3, 4, 5, 6, 7, 8]}
        rows={d.items.map((w: any) => [w.name, w.orders, money(w.sales), money(w.avg_ticket), w.covers, money(w.tips), w.avg_minutes ?? "—", w.voids ? `${w.voids} (${money(w.voids_amount)})` : "0", money(w.discounts)])} />
      <p className="r2-muted">{d.note}</p>
    </div>
  );
}

export function Costs({ d }: { d: any }) {
  return (
    <div className="r3-page">
      <div className="r3-kpis">
        <Kpi label="Food cost teórico" value={d.theoretical_pct === null ? "—" : `${n1(d.theoretical_pct)}%`} sub={money(d.theoretical_cost)} />
        <Kpi label="Food cost real" value={d.real_pct === null ? "—" : `${n1(d.real_pct)}%`} sub={money(d.real_cost)} />
        <Kpi label="Compras" value={money(d.purchases)} sub={d.purchases_pct === null ? undefined : `${n1(d.purchases_pct)}% de las ventas netas`} />
        <Kpi label="Debemos a proveedores" value={money(d.supplier_debt)} sub={d.supplier_overdue ? `${d.supplier_overdue} vencidas` : undefined} tone={d.supplier_overdue ? "down" : undefined} />
      </div>
      <div className="r3-kpis"><Kpi label="Ventas netas (sin IVA)" value={money(d.net_sales)} /><Kpi label="Mermas" value={money(d.waste)} /><Kpi label="Faltantes de inventario" value={money(d.inventory_shortage)} /></div>
      {d.waste_by_ingredient.length > 0 && <><h3>Lo que más se pierde</h3><BarList rows={d.waste_by_ingredient.map((w: any) => ({ label: w.name, value: w.amount }))} format={money} /></>}
      {d.products_without_cost > 0 && <div className="rs-note rs-note-warn">{d.products_without_cost} productos vendidos no tienen receta con costo: el teórico no los incluye.</div>}
      <p className="r2-muted">{d.note}</p>
    </div>
  );
}

export function Cash({ d }: { d: any }) {
  return (
    <div className="r3-page">
      <div className="r3-kpis">
        <Kpi label="Turnos" value={d.totals.shifts} sub={`${d.totals.closed} cerrados`} /><Kpi label="Cobrado" value={money(d.totals.sales)} />
        <Kpi label="Diferencia acumulada" value={money(d.totals.difference)} sub={`${d.totals.with_difference} cierres con diferencia`} tone={d.totals.difference < 0 ? "down" : undefined} />
        {d.controls && <Kpi label="Controles" value={`${d.controls.voids + d.controls.discounts + d.controls.comps}`} sub={`${d.controls.voids} anulaciones · ${d.controls.discounts} descuentos · ${d.controls.comps} cortesías`} />}
      </div>
      {d.mine_only && <p className="r2-muted">Ves solo los turnos que abriste vos.</p>}
      {d.items.length === 0 ? <p className="r2-muted">No hay turnos de caja en este período.</p> : (
        <Table heads={["Caja", "Abrió", "Fecha", "Fondo", "Cobrado", "Esperado", "Contado", "Diferencia"]} num={[3, 4, 5, 6, 7]}
          rows={d.items.map((s: any) => [s.register, s.opened_by || "—", new Date(s.opened_at).toLocaleDateString("es-AR"), money(s.opening_float), money(s.sales),
            s.expected_cash === null ? "—" : money(s.expected_cash), s.counted_cash === null ? "—" : money(s.counted_cash),
            s.status !== "CERRADO" ? <Pill tone="blue">Abierto</Pill> : s.difference ? <span className={s.difference < 0 ? "r3-down" : "r3-up"}>{money(s.difference)}</span> : <Pill tone="green">Sin diferencia</Pill>])} />
      )}
    </div>
  );
}
