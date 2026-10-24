import { useState } from "react";
import { appApi, money } from "../../config";
import { Field, Modal, Pill, numOrNull, strOrNull } from "../ui";
import { ConfirmModal, EmptyAction } from "../r1/common";
import type { Category, Notify, Product, Station } from "./types";

interface Slot { name: string; options: { product_id: string; surcharge: string }[] }

export default function CombosTab({ cats, prods, stations, reload, show, fail }: Notify & {
  cats: Category[]; prods: Product[]; stations: Station[]; reload: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const combos = prods.filter((p) => p.kind === "COMBO");
  return (
    <>
      <div className="rs-toolbar">
        <p className="rs-muted" style={{ margin: 0 }}>Un combo tiene un precio cerrado y huecos para elegir (la hamburguesa, la bebida, el acompañamiento).</p>
        <button className="primary-button" disabled={!cats.length} onClick={() => setEditing("new")}>Nuevo combo</button>
      </div>
      {!combos.length ? <div className="rs-card"><EmptyAction title="Todavía no hay combos" text="Armá promos como «Menú del día» con opciones por hueco y recargos opcionales." action={cats.length ? "Crear un combo" : undefined} onAction={() => setEditing("new")} /></div> : (
        <div className="rs-grid-2">
          {combos.map((c) => (
            <div key={c.id} className="rs-card">
              <div className="rs-card-head"><div><h2>{c.name}</h2><p>{cats.find((x) => x.id === c.category_id)?.name}</p></div><strong className="r1-price">{money(c.price)}</strong></div>
              <ul className="rs-list">{(c.slots || []).map((s) => <li key={s.id}><div className="rs-list-main"><strong>{s.name}</strong><small>{s.options.map((o) => o.name + (o.surcharge ? ` (+${money(o.surcharge)})` : "")).join(" · ")}</small></div></li>)}</ul>
              <div className="rs-row" style={{ marginTop: 10 }}>{!c.active && <Pill tone="gray">Inactivo</Pill>}{c.sold_out && <Pill tone="red">Agotado</Pill>}
                <button className="secondary-button" style={{ marginLeft: "auto" }} onClick={() => setEditing(c)}>Editar</button></div>
            </div>))}
        </div>
      )}
      {editing && <ComboModal combo={editing === "new" ? null : editing} cats={cats} prods={prods.filter((p) => p.kind === "SIMPLE" && p.active)} stations={stations} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function ComboModal({ combo, cats, prods, stations, onClose, reload, show, fail }: Notify & {
  combo: Product | null; cats: Category[]; prods: Product[]; stations: Station[]; onClose: () => void; reload: () => Promise<void> | void;
}) {
  const [f, setF] = useState({ name: combo?.name ?? "", category_id: String(combo?.category_id ?? cats[0]?.id ?? ""), price: combo ? String(combo.price) : "",
    description: combo?.description ?? "", station_id: combo?.station_id ? String(combo.station_id) : "", active: combo?.active ?? true });
  const [slots, setSlots] = useState<Slot[]>((combo?.slots ?? []).map((s) => ({ name: s.name, options: s.options.map((o) => ({ product_id: String(o.product_id), surcharge: o.surcharge ? String(o.surcharge) : "" })) })));
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const updSlot = (i: number, p: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save() {
    setBusy(true);
    try {
      const body = { category_id: Number(f.category_id), name: f.name, description: strOrNull(f.description), price: numOrNull(f.price), station_id: f.station_id ? Number(f.station_id) : null, active: f.active,
        slots: slots.map((s) => ({ name: s.name, options: s.options.filter((o) => o.product_id).map((o) => ({ product_id: Number(o.product_id), surcharge: numOrNull(o.surcharge) ?? 0 })) })) };
      await appApi(combo ? `/combos/${combo.id}` : "/combos", { method: combo ? "PUT" : "POST", body });
      show("Combo guardado"); await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/combos/${combo!.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="COMBO" title={combo ? combo.name : "Nuevo combo"} size="wide" onClose={onClose}
      footer={<>
        {combo && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="r1-grid-form">
        <Field label="Nombre"><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Categoría"><select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Precio del combo"><input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Estación"><select value={f.station_id} onChange={(e) => setF({ ...f, station_id: e.target.value })}><option value="">Por defecto</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Descripción" wide><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="rs-inline-checks" style={{ gridColumn: "1 / -1" }}><label><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activo</label></div>
      </div>
      <h3 style={{ margin: "16px 0 8px", fontSize: 14, color: "var(--rs-ink)" }}>Huecos del combo</h3>
      <div className="r1-rows">
        {slots.map((s, i) => (
          <div key={i} className="rs-card" style={{ padding: 12, boxShadow: "none" }}>
            <div className="r1-row-edit" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <input aria-label="Nombre del hueco" placeholder="Ej: Bebida" value={s.name} onChange={(e) => updSlot(i, { name: e.target.value })} />
              <button className="rs-link rs-link-danger" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))}>Quitar hueco</button>
            </div>
            {s.options.map((o, k) => (
              <div key={k} className="r1-row-edit" style={{ marginTop: 8, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) auto" }}>
                <select aria-label="Producto" value={o.product_id} onChange={(e) => updSlot(i, { options: s.options.map((x, j) => (j === k ? { ...x, product_id: e.target.value } : x)) })}>
                  <option value="">Elegí un producto</option>{prods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input aria-label="Recargo" inputMode="decimal" placeholder="Recargo" value={o.surcharge} onChange={(e) => updSlot(i, { options: s.options.map((x, j) => (j === k ? { ...x, surcharge: e.target.value } : x)) })} />
                <button className="rs-link rs-link-danger" onClick={() => updSlot(i, { options: s.options.filter((_, j) => j !== k) })}>Quitar</button>
              </div>))}
            <button className="secondary-button" style={{ marginTop: 8 }} onClick={() => updSlot(i, { options: [...s.options, { product_id: "", surcharge: "" }] })}>Agregar opción</button>
          </div>))}
      </div>
      <button className="secondary-button" style={{ marginTop: 12 }} onClick={() => setSlots((x) => [...x, { name: "", options: [{ product_id: "", surcharge: "" }] }])}>Agregar hueco</button>
      {ask && <ConfirmModal title={`Borrar «${combo?.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(false)} onConfirm={del}>Si ya se vendió queda inactivo para conservar el historial.</ConfirmModal>}
    </Modal>
  );
}
