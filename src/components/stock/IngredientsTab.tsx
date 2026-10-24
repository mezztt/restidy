import { useMemo, useState } from "react";
import { appApi } from "../../config";
import { Field, Modal, Pill, numOrNull, strOrNull } from "../ui";
import { ConfirmModal, EmptyAction, fmtMoney, fmtQty, QtyInput } from "../r1/common";
import type { Ingredient, Notify, SupplierOpt } from "./types";

const UNITS: [string, string][] = [["kg", "Kilos (kg)"], ["l", "Litros (l)"], ["u", "Unidades (u)"], ["g", "Gramos (g)"], ["ml", "Mililitros (ml)"]];
const STATE_PILL: Record<string, [string, string]> = { OK: ["green", "Bien"], BAJO: ["orange", "Bajo el mínimo"], NEGATIVO: ["red", "En negativo"] };

export default function IngredientsTab({ ings, suppliers, initialState, reload, show, fail }: Notify & {
  ings: Ingredient[]; suppliers: SupplierOpt[]; initialState: string; reload: () => Promise<void> | void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState(initialState);
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  const cats = useMemo(() => [...new Set(ings.map((i) => i.category).filter(Boolean) as string[])].sort(), [ings]);
  const list = ings.filter((i) => (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())) && (!state || i.state === state) && (!cat || i.category === cat));
  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-filters">
          <input className="rs-search" placeholder="Buscar insumo..." aria-label="Buscar insumo" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Estado" value={state} onChange={(e) => setState(e.target.value)}><option value="">Todos</option><option value="BAJO">Bajo el mínimo</option><option value="NEGATIVO">En negativo</option></select>
          {cats.length > 0 && <select aria-label="Rubro" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todos los rubros</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>}
        </div>
        <button className="primary-button" onClick={() => setEditing("new")}>Nuevo insumo</button>
      </div>
      {!ings.length ? <div className="rs-card"><EmptyAction title="Todavía no cargaste insumos" text="Los insumos son la mercadería que usás (carne, harina, gaseosas). Con ellos armás las recetas y se descuenta solo al vender." action="Cargar el primero" onAction={() => setEditing("new")} /></div>
        : !list.length ? <div className="rs-card"><EmptyAction title="Nada con ese filtro" text="Probá con otra búsqueda." /></div> : (
          <div className="rs-table-wrap"><table className="rs-table">
            <thead><tr><th>Insumo</th><th className="num">Stock</th><th className="num">Mínimo</th><th className="num">Costo prom.</th><th className="num">Valor</th><th>Estado</th></tr></thead>
            <tbody>{list.map((i) => (
              <tr key={i.id} className="is-click" onClick={() => setEditing(i)} style={i.active ? undefined : { opacity: 0.6 }}>
                <td><strong>{i.name}</strong><small>{[i.category, i.default_supplier_name].filter(Boolean).join(" · ") || (i.active ? "" : "Inactivo")}</small></td>
                <td className="num"><strong>{fmtQty(i.stock_qty, i.unit)}</strong></td>
                <td className="num">{i.min_qty ? fmtQty(i.min_qty, i.unit) : "—"}</td>
                <td className="num">{fmtMoney(i.cost_avg)} <small>/{i.unit}</small></td>
                <td className="num">{fmtMoney(i.stock_value)}</td>
                <td>{i.active ? <Pill tone={STATE_PILL[i.state][0]}>{STATE_PILL[i.state][1]}</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
              </tr>))}</tbody>
          </table></div>)}
      {editing && <IngredientModal ing={editing === "new" ? null : editing} suppliers={suppliers} cats={cats} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function IngredientModal({ ing, suppliers, cats, onClose, reload, show, fail }: Notify & { ing: Ingredient | null; suppliers: SupplierOpt[]; cats: string[]; onClose: () => void; reload: () => Promise<void> | void }) {
  const [f, setF] = useState({ name: ing?.name ?? "", unit: ing?.unit ?? "kg", category: ing?.category ?? "", supplier: ing?.default_supplier_id ? String(ing.default_supplier_id) : "", active: ing?.active ?? true });
  const [min, setMin] = useState<number | null>(ing?.min_qty ?? null);
  const [stock, setStock] = useState<number | null>(null);
  const [cost, setCost] = useState(ing ? "" : "");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name: f.name, unit: f.unit, category: strOrNull(f.category), default_supplier_id: f.supplier ? Number(f.supplier) : null, min_qty: min ?? 0, active: f.active };
      if (!ing) { body.stock_qty = stock ?? 0; body.cost = numOrNull(cost) ?? 0; }
      await appApi(ing ? `/ingredients/${ing.id}` : "/ingredients", { method: ing ? "PUT" : "POST", body });
      show("Insumo guardado"); await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/ingredients/${ing!.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="INSUMO" title={ing ? ing.name : "Nuevo insumo"} size="wide" onClose={onClose}
      footer={<>{ing && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="r1-grid-form">
        <Field label="Nombre"><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Carne picada" /></Field>
        <Field label="Unidad" hint={ing ? "Cambiarla no convierte el stock cargado." : "En qué lo comprás y lo contás."}>
          <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Rubro" hint="Sirve para filtrar y para contar el inventario por sectores."><input list="r1-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Carnes, Bebidas, Almacén..." /><datalist id="r1-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Stock mínimo" hint="Por debajo de esto te avisamos."><QtyInput key={f.unit} value={min} unit={f.unit} onChange={setMin} ariaLabel="Stock mínimo" /></Field>
        {!ing && <>
          <Field label="Stock inicial"><QtyInput key={`s${f.unit}`} value={stock} unit={f.unit} onChange={setStock} ariaLabel="Stock inicial" /></Field>
          <Field label={`Costo por ${f.unit}`} hint="Después se actualiza solo con cada compra."><input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </>}
        {suppliers.length > 0 && <Field label="Proveedor habitual"><select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}><option value="">Sin definir</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
        <div className="rs-inline-checks" style={{ gridColumn: "1 / -1" }}><label><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activo</label></div>
      </div>
      {ing && <p className="rs-muted" style={{ marginTop: 10 }}>Stock actual {fmtQty(ing.stock_qty, ing.unit)} · costo promedio {fmtMoney(ing.cost_avg)}/{ing.unit} · último {fmtMoney(ing.cost_last)}. Para corregir el stock usá «Mermas y movimientos».</p>}
      {ask && <ConfirmModal title={`Borrar «${ing?.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(false)} onConfirm={del}>Si está en recetas o tiene movimientos queda inactivo en vez de borrarse.</ConfirmModal>}
    </Modal>
  );
}
