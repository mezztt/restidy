import { useState } from "react";
import { appApi, money } from "../../config";
import { Field, Modal, Pill, numOrNull, strOrNull } from "../ui";
import { ConfirmModal, EmptyAction } from "../r1/common";
import type { Category, Notify, PriceRule, Product } from "./types";
import { CHANNEL_LABEL, DAY_LONG, DAY_SHORT } from "./types";

const dayText = (d: number[]) => (!d.length || d.length === 7 ? "Todos los días" : d.map((x) => DAY_LONG[x]).join(", "));

export default function RulesTab({ rules, cats, prods, reload, show, fail }: Notify & {
  rules: PriceRule[]; cats: Category[]; prods: Product[]; reload: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<PriceRule | "new" | null>(null);
  return (
    <>
      <div className="rs-toolbar">
        <p className="rs-muted" style={{ margin: 0 }}>Happy hour, descuentos por día o precios distintos según el canal. Se aplican solos en el horario indicado.</p>
        <button className="primary-button" onClick={() => setEditing("new")}>Nueva regla</button>
      </div>
      {!rules.length ? <div className="rs-card"><EmptyAction title="No hay reglas de precio" text="Ejemplo: 20% de descuento en tragos de lunes a jueves de 18 a 20." action="Crear una regla" onAction={() => setEditing("new")} /></div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Regla</th><th>Cuándo</th><th>Canal</th><th>A qué</th><th>Efecto</th><th>Estado</th><th></th></tr></thead>
          <tbody>{rules.map((r) => (
            <tr key={r.id} className="is-click" onClick={() => setEditing(r)}>
              <td><strong>{r.name}</strong></td>
              <td>{dayText(r.days)}<small>{r.time_from ? `${r.time_from} a ${r.time_to}` : "Todo el día"}</small></td>
              <td>{CHANNEL_LABEL[r.channel] || r.channel}</td>
              <td>{r.scope_name || "—"}</td>
              <td>{r.kind === "PCT" ? `${r.value}% menos` : `Precio fijo ${money(r.value)}`}</td>
              <td>{!r.active ? <Pill tone="gray">Pausada</Pill> : r.active_now ? <Pill tone="green">Vigente ahora</Pill> : <Pill tone="blue">Programada</Pill>}</td>
              <td><button className="secondary-button" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Editar</button></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {editing && <RuleModal rule={editing === "new" ? null : editing} cats={cats} prods={prods} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function RuleModal({ rule, cats, prods, onClose, reload, show, fail }: Notify & {
  rule: PriceRule | null; cats: Category[]; prods: Product[]; onClose: () => void; reload: () => Promise<void> | void;
}) {
  const [f, setF] = useState({ name: rule?.name ?? "", channel: rule?.channel ?? "TODOS", days: rule?.days ?? [], time_from: rule?.time_from ?? "", time_to: rule?.time_to ?? "",
    scope: rule?.scope ?? "CATEGORIA", scope_id: rule?.scope_id ? String(rule.scope_id) : "", kind: rule?.kind ?? "PCT", value: rule ? String(rule.value) : "", priority: String(rule?.priority ?? 0), active: rule?.active ?? true });
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      await appApi(rule ? `/price-rules/${rule.id}` : "/price-rules", { method: rule ? "PUT" : "POST", body: {
        name: f.name, channel: f.channel, days: f.days, time_from: strOrNull(f.time_from), time_to: strOrNull(f.time_to), scope: f.scope,
        scope_id: f.scope === "TODO" ? null : Number(f.scope_id) || null, kind: f.kind, value: numOrNull(f.value) ?? 0, priority: Number(f.priority) || 0, active: f.active } });
      show("Regla guardada"); await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { await appApi(`/price-rules/${rule!.id}`, { method: "DELETE" }); show("Regla borrada"); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="PRECIOS POR HORARIO" title={rule ? rule.name : "Nueva regla"} size="wide" onClose={onClose}
      footer={<>
        {rule && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="r1-grid-form">
        <Field label="Nombre"><input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Happy hour" /></Field>
        <Field label="Canal"><select value={f.channel} onChange={(e) => set("channel", e.target.value)}>{Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Días" wide hint="Sin marcar = todos los días.">
          <div className="r1-chips">{DAY_SHORT.map((d, i) => { const on = f.days.includes(i);
            return <button key={i} type="button" aria-pressed={on} aria-label={DAY_LONG[i]} className={`r1-chip ${on ? "is-on" : ""}`} onClick={() => set("days", on ? f.days.filter((x) => x !== i) : [...f.days, i])}>{d}</button>; })}</div>
        </Field>
        <Field label="Desde" hint="Vacío = todo el día. Si termina pasada la medianoche, vale hasta esa hora."><input type="time" value={f.time_from} onChange={(e) => set("time_from", e.target.value)} /></Field>
        <Field label="Hasta"><input type="time" value={f.time_to} onChange={(e) => set("time_to", e.target.value)} /></Field>
        <Field label="Se aplica a">
          <select value={f.scope} onChange={(e) => { set("scope", e.target.value as PriceRule["scope"]); set("scope_id", ""); if (e.target.value !== "PRODUCTO") set("kind", "PCT"); }}>
            <option value="CATEGORIA">Una categoría</option><option value="PRODUCTO">Un producto</option><option value="TODO">Toda la carta</option>
          </select>
        </Field>
        {f.scope !== "TODO" && (
          <Field label={f.scope === "PRODUCTO" ? "Producto" : "Categoría"}>
            <select value={f.scope_id} onChange={(e) => set("scope_id", e.target.value)}><option value="">Elegí uno</option>
              {f.scope === "PRODUCTO" ? prods.filter((p) => p.kind === "SIMPLE").map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>)}
        <Field label="Tipo"><select value={f.kind} onChange={(e) => set("kind", e.target.value as PriceRule["kind"])}><option value="PCT">Descuento en %</option>{f.scope === "PRODUCTO" && <option value="PRECIO_FIJO">Precio fijo</option>}</select></Field>
        <Field label={f.kind === "PCT" ? "Descuento (%)" : "Precio"}><input inputMode="decimal" value={f.value} onChange={(e) => set("value", e.target.value)} /></Field>
        <Field label="Prioridad" hint="Si dos reglas coinciden, gana la de mayor número."><input inputMode="numeric" value={f.priority} onChange={(e) => set("priority", e.target.value)} /></Field>
        <div className="rs-inline-checks" style={{ gridColumn: "1 / -1" }}><label><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Regla activa</label></div>
      </div>
      <div className="rs-note rs-note-info" style={{ marginTop: 12 }}>Un precio autorizado a mano en la mesa siempre gana sobre la regla. Las reglas no cambian el precio de los pedidos ya tomados.</div>
      {ask && <ConfirmModal title={`Borrar «${rule?.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(false)} onConfirm={del}>Los productos vuelven a su precio normal.</ConfirmModal>}
    </Modal>
  );
}
