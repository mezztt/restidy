import { useEffect, useState } from "react";
import { appApi, money } from "../../config";
import { Field, Modal, Pill, numOrNull } from "../ui";
import { ConfirmModal, EmptyAction } from "../r1/common";
import type { AllergenCat, ModGroup, Notify } from "./types";

interface Ing { id: number; name: string; unit: string }
interface OptRow { id?: number; name: string; price_delta: string; ingredient_id: string; ingredient_qty: string; allergen_codes: string[]; active: boolean }

export default function GroupsTab({ groups, allergens, hasStock, reload, show, fail }: Notify & {
  groups: ModGroup[]; allergens: AllergenCat[]; hasStock: boolean; reload: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<ModGroup | "new" | null>(null);
  const [ings, setIngs] = useState<Ing[]>([]);
  useEffect(() => { if (hasStock) appApi<Ing[]>("/ingredients").then(setIngs).catch(() => {}); }, [hasStock]);
  return (
    <>
      <div className="rs-toolbar">
        <p className="rs-muted" style={{ margin: 0 }}>Opciones que el cliente elige al pedir: punto de cocción, extras, salsas, sin cebolla...</p>
        <button className="primary-button" onClick={() => setEditing("new")}>Nuevo grupo</button>
      </div>
      {!groups.length ? <div className="rs-card"><EmptyAction title="Todavía no hay grupos de adicionales" text="Creá uno (Ej: «Punto de cocción» con Jugoso, A punto, Cocido) y asignalo a los productos." action="Crear el primero" onAction={() => setEditing("new")} /></div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Grupo</th><th>Opciones</th><th>Elige</th><th>Productos</th><th></th></tr></thead>
          <tbody>{groups.map((g) => (
            <tr key={g.id} className="is-click" onClick={() => setEditing(g)}>
              <td><strong>{g.name}</strong></td>
              <td>{g.options.map((o) => o.name + (o.price_delta ? ` (${o.price_delta > 0 ? "+" : ""}${money(o.price_delta)})` : "")).join(" · ") || "—"}</td>
              <td>{g.required ? <Pill tone="orange">Obligatorio</Pill> : <Pill tone="gray">Opcional</Pill>} <small>{g.min_select}–{g.max_select}</small></td>
              <td>{g.product_count}</td>
              <td><button className="secondary-button" onClick={(e) => { e.stopPropagation(); setEditing(g); }}>Editar</button></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {editing && <GroupModal group={editing === "new" ? null : editing} allergens={allergens} ings={ings} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function GroupModal({ group, allergens, ings, onClose, reload, show, fail }: Notify & {
  group: ModGroup | null; allergens: AllergenCat[]; ings: Ing[]; onClose: () => void; reload: () => Promise<void> | void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [min, setMin] = useState(String(group?.min_select ?? 0));
  const [max, setMax] = useState(String(group?.max_select ?? 1));
  const [required, setRequired] = useState(group?.required ?? false);
  const [opts, setOpts] = useState<OptRow[]>(group?.options.map((o) => ({ id: o.id, name: o.name, price_delta: o.price_delta ? String(o.price_delta) : "",
    ingredient_id: o.ingredient_id ? String(o.ingredient_id) : "", ingredient_qty: o.ingredient_qty ? String(o.ingredient_qty) : "", allergen_codes: o.allergen_codes, active: o.active })) ?? []);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const upd = (i: number, p: Partial<OptRow>) => setOpts((o) => o.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save() {
    setBusy(true);
    try {
      const body = { name, min_select: Number(min) || 0, max_select: Number(max) || 1, required, options: opts.filter((o) => o.name.trim()).map((o) => ({
        id: o.id ?? null, name: o.name, price_delta: numOrNull(o.price_delta) ?? 0, ingredient_id: o.ingredient_id ? Number(o.ingredient_id) : null,
        ingredient_qty: o.ingredient_id ? numOrNull(o.ingredient_qty) : null, allergen_codes: o.allergen_codes, active: o.active })) };
      await appApi(group ? `/modifier-groups/${group.id}` : "/modifier-groups", { method: group ? "PUT" : "POST", body });
      show("Grupo guardado"); await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/modifier-groups/${group!.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="ADICIONALES" title={group ? group.name : "Nuevo grupo"} size="wide" onClose={onClose}
      footer={<>
        {group && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="r1-grid-form">
        <Field label="Nombre del grupo"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Punto de cocción" /></Field>
        <div className="r1-grid-form">
          <Field label="Mínimo a elegir"><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Máximo a elegir"><input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
        </div>
        <div className="rs-inline-checks" style={{ gridColumn: "1 / -1" }}><label><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Es obligatorio elegir (no se puede mandar a cocina sin esto)</label></div>
      </div>
      <h3 style={{ margin: "16px 0 8px", fontSize: 14, color: "var(--rs-ink)" }}>Opciones</h3>
      <div className="r1-rows">
        {opts.map((o, i) => (
          <div key={o.id ?? `n${i}`} className="rs-card" style={{ padding: 12, boxShadow: "none" }}>
            <div className="r1-row-edit" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) auto" }}>
              <input aria-label="Nombre de la opción" placeholder="Nombre (Ej: Bien cocido)" value={o.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <input aria-label="Diferencia de precio" inputMode="decimal" placeholder="+ precio" value={o.price_delta} onChange={(e) => upd(i, { price_delta: e.target.value })} />
              <div className="rs-row" style={{ gap: 8 }}>
                <label><input type="checkbox" checked={o.active} onChange={(e) => upd(i, { active: e.target.checked })} /> Activa</label>
                <button className="rs-link rs-link-danger" onClick={() => setOpts((x) => x.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
            {ings.length > 0 && (
              <div className="r1-row-edit" style={{ marginTop: 8, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
                <select aria-label="Insumo que descuenta" value={o.ingredient_id} onChange={(e) => upd(i, { ingredient_id: e.target.value })}>
                  <option value="">No descuenta stock</option>{ings.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
                </select>
                <input aria-label="Cantidad de insumo" inputMode="decimal" placeholder="Cantidad" disabled={!o.ingredient_id} value={o.ingredient_qty} onChange={(e) => upd(i, { ingredient_qty: e.target.value })} />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <span className="rs-hint" style={{ marginTop: 0 }}>Alérgenos que agrega esta opción:</span>
              <div className="r1-chips" style={{ marginTop: 4 }}>
                {allergens.map((a) => {
                  const on = o.allergen_codes.includes(a.code);
                  return <button key={a.code} type="button" aria-pressed={on} className={`r1-chip ${on ? "is-on-warn" : ""}`}
                    onClick={() => upd(i, { allergen_codes: on ? o.allergen_codes.filter((c) => c !== a.code) : [...o.allergen_codes, a.code] })}>{a.name}</button>;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!opts.length && <div className="rs-empty">Agregá al menos una opción.</div>}
      <button className="secondary-button" style={{ marginTop: 12 }} onClick={() => setOpts((x) => [...x, { name: "", price_delta: "", ingredient_id: "", ingredient_qty: "", allergen_codes: [], active: true }])}>Agregar opción</button>
      {ask && <ConfirmModal title={`Borrar «${group?.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(false)} onConfirm={del}>Se quita de los productos que lo usan.</ConfirmModal>}
    </Modal>
  );
}
