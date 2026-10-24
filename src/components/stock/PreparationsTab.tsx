import { useState } from "react";
import { appApi } from "../../config";
import { Field, Modal } from "../ui";
import { ConfirmModal, EmptyAction, fmtMoney } from "../r1/common";
import RecipeItemsEditor, { itemsFromRecipe, itemsToPayload } from "./RecipeItemsEditor";
import type { RItem } from "./RecipeItemsEditor";
import type { Ingredient, Notify, Recipe } from "./types";

export default function PreparationsTab({ ings, preps, reload, show, fail }: Notify & { ings: Ingredient[]; preps: Recipe[]; reload: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  return (
    <>
      <div className="rs-toolbar">
        <p className="rs-muted" style={{ margin: 0 }}>Salsas, masas, fondos: se preparan en tanda y se usan como renglón en varias recetas.</p>
        <button className="primary-button" onClick={() => setEditing("new")}>Nueva preparación</button>
      </div>
      {!preps.length ? <div className="rs-card"><EmptyAction title="No hay preparaciones" text="Ejemplo: «Salsa de tomate» que rinde 2 litros y usás en pizzas y pastas." action="Crear una" onAction={() => setEditing("new")} /></div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Preparación</th><th>Rinde</th><th>Renglones</th><th className="num">Costo por unidad</th></tr></thead>
          <tbody>{preps.map((p) => (
            <tr key={p.id} className="is-click" onClick={() => setEditing(p)}>
              <td><strong>{p.name}</strong></td><td>{p.yield_qty} {p.yield_unit}</td><td>{p.items.length}</td>
              <td className="num">{p.cost != null ? fmtMoney(p.cost) : "—"}</td>
            </tr>))}</tbody>
        </table></div>)}
      {editing && <PrepModal prep={editing === "new" ? null : editing} ings={ings} preps={preps.filter((p) => editing === "new" || p.id !== editing.id)} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function PrepModal({ prep, ings, preps, onClose, reload, show, fail }: Notify & { prep: Recipe | null; ings: Ingredient[]; preps: Recipe[]; onClose: () => void; reload: () => Promise<void> | void }) {
  const [name, setName] = useState(prep?.name ?? "");
  const [yq, setYq] = useState(prep ? String(prep.yield_qty) : "1");
  const [yu, setYu] = useState(prep?.yield_unit ?? "porción");
  const [items, setItems] = useState<RItem[]>(itemsFromRecipe(prep ?? undefined));
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await appApi(prep ? `/recipes/${prep.id}` : "/recipes", { method: prep ? "PUT" : "POST", body: { name, yield_qty: Number(yq.replace(",", ".")) || 1, yield_unit: yu, items: itemsToPayload(items) } });
      show("Preparación guardada"); await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/recipes/${prep!.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="PREPARACIÓN" title={prep ? prep.name : "Nueva preparación"} size="wide" onClose={onClose}
      footer={<>{prep && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="r1-grid-form" style={{ marginBottom: 14 }}>
        <Field label="Nombre"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="r1-grid-form">
          <Field label="Rinde"><input inputMode="decimal" value={yq} onChange={(e) => setYq(e.target.value)} /></Field>
          <Field label="Unidad"><input value={yu} onChange={(e) => setYu(e.target.value)} maxLength={10} placeholder="l, kg, porción" /></Field>
        </div>
      </div>
      <RecipeItemsEditor items={items} onChange={setItems} ingredients={ings} preps={preps} yieldQty={Number(yq.replace(",", ".")) || 1} />
      {ask && <ConfirmModal title={`Borrar «${prep?.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(false)} onConfirm={del}>Si alguna receta la usa, el sistema no la borra.</ConfirmModal>}
    </Modal>
  );
}
