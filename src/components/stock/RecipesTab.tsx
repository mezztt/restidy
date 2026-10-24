import { useCallback, useEffect, useState } from "react";
import { appApi, money } from "../../config";
import { Field, Loading, Modal, Pill } from "../ui";
import { EmptyAction, fmtNum, LightPill } from "../r1/common";
import type { Light } from "../r1/common";
import RecipeItemsEditor, { itemsFromRecipe, itemsToPayload } from "./RecipeItemsEditor";
import type { RItem } from "./RecipeItemsEditor";
import type { CostsPayload, CostRow, Ingredient, Notify, Recipe } from "./types";

interface ProductRecipe {
  product: { id: number; name: string; price: number; kind: string };
  variants: { id: number; name: string; price: number; recipe_factor: number }[];
  recipes: Recipe[];
}

export default function RecipesTab({ ings, preps, reload, show, fail }: Notify & { ings: Ingredient[]; preps: Recipe[]; reload: () => Promise<void> | void }) {
  const [data, setData] = useState<CostsPayload | null>(null);
  const [light, setLight] = useState<"" | Light>("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<CostRow | null>(null);
  const load = useCallback(() => appApi<CostsPayload>("/stock/costs").then(setData).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Loading />;
  const rows = data.rows.filter((r) => (!light || r.light === light) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())));
  const s = data.summary;
  const chip = (k: "" | Light, label: string, n: number) => <button type="button" className={`r1-chip ${light === k ? "is-on" : ""}`} aria-pressed={light === k} onClick={() => setLight(k)}>{label} · {n}</button>;
  return (
    <>
      <div className="rs-note rs-note-info" style={{ marginBottom: 14 }}>
        El costo del plato sale de la receta y el costo promedio de cada insumo. Se compara con el precio <strong>sin IVA ({fmtNum(data.thresholds.iva_pct, 1)}%)</strong>:
        verde hasta {data.thresholds.green}%, ámbar hasta {data.thresholds.amber}% y rojo por encima. Los umbrales se cambian en Configuración, Controles.
      </div>
      <div className="rs-toolbar">
        <div className="r1-chips">{chip("", "Todos", s.total)}{chip("ROJO", "Rojo", s.rojo)}{chip("AMBAR", "Ámbar", s.ambar)}{chip("VERDE", "Verde", s.verde)}{chip("SIN_COSTO", "Sin receta", s.sin_costo)}</div>
        <input className="rs-search" placeholder="Buscar plato..." aria-label="Buscar plato" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!data.rows.length ? <div className="rs-card"><EmptyAction title="No hay platos para costear" text="Cargá productos en la Carta y volvé para armar sus recetas." /></div> : !rows.length ? <div className="rs-card"><EmptyAction title="Nada con ese filtro" text="Probá con otro semáforo." /></div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Plato</th><th className="num">Precio</th><th className="num">Costo</th><th className="num">Costo %</th><th className="num">Ganancia</th><th>Semáforo</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="is-click" onClick={() => setEditing(r)}>
              <td><strong>{r.name}</strong><small>{r.category_name}{r.incomplete ? " · faltan costos de insumos" : ""}</small></td>
              <td className="num">{money(r.price)}</td>
              <td className="num">{r.cost != null ? money(r.cost) : "—"}</td>
              <td className="num">{r.food_cost_pct != null ? `${fmtNum(r.food_cost_pct, 1)}%` : "—"}</td>
              <td className="num">{r.margin != null ? money(r.margin) : "—"}</td>
              <td>{r.has_recipe ? <LightPill light={r.light} /> : <Pill tone="gray">Sin receta</Pill>}</td>
            </tr>))}</tbody>
        </table></div>)}
      {editing && <RecipeModal row={editing} ings={ings} preps={preps} onClose={() => setEditing(null)} onSaved={async () => { await load(); await reload(); }} show={show} fail={fail} />}
    </>
  );
}

function RecipeModal({ row, ings, preps, onClose, onSaved, show, fail }: Notify & { row: CostRow; ings: Ingredient[]; preps: Recipe[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<ProductRecipe | null>(null);
  const [variant, setVariant] = useState<number | 0>(0);
  const [items, setItems] = useState<RItem[]>([]);
  const [yieldQty, setYield] = useState("1");
  const [busy, setBusy] = useState(false);
  const pick = useCallback((d: ProductRecipe, v: number) => {
    const rec = d.recipes.find((r) => (r.variant_id || 0) === v);
    setItems(itemsFromRecipe(rec)); setYield(rec ? String(rec.yield_qty) : "1");
  }, []);
  useEffect(() => { appApi<ProductRecipe>(`/products/${row.id}/recipe`).then((d) => { setData(d); pick(d, 0); }).catch(fail); }, [row.id, pick, fail]);

  async function save() {
    setBusy(true);
    try {
      const d = await appApi<ProductRecipe>(`/products/${row.id}/recipe`, { method: "PUT", body: { variant_id: variant || null, yield_qty: Number(yieldQty.replace(",", ".")) || 1, items: itemsToPayload(items) } });
      setData(d); show(items.length ? "Receta guardada" : "Receta quitada"); await onSaved();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const current = data?.recipes.find((r) => (r.variant_id || 0) === variant);
  return (
    <Modal eyebrow="RECETA" title={row.name} size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" onClick={save} disabled={busy || !data}>{busy ? "Guardando..." : "Guardar receta"}</button></>}>
      {!data ? <Loading /> : (
        <div className="rs-stack">
          {data.variants.length > 0 && (
            <Field label="Receta de" hint="Si una variante no tiene receta propia usa la base multiplicada por su factor.">
              <select value={variant} onChange={(e) => { const v = Number(e.target.value); setVariant(v); pick(data, v); }}>
                <option value={0}>Producto base ({money(data.product.price)})</option>
                {data.variants.map((v) => <option key={v.id} value={v.id}>{v.name} (factor {v.recipe_factor})</option>)}
              </select>
            </Field>)}
          <Field label="La receta rinde (porciones)" hint="Casi siempre 1. Si es para una tanda (una pizza grande en 8 porciones), poné el número."><input style={{ maxWidth: 120 }} inputMode="decimal" value={yieldQty} onChange={(e) => setYield(e.target.value)} /></Field>
          <RecipeItemsEditor items={items} onChange={setItems} ingredients={ings} preps={preps} yieldQty={Number(yieldQty.replace(",", ".")) || 1} />
          {current?.cost != null && <p className="rs-muted">Costo guardado: <strong>{money(current.cost)}</strong> por porción.</p>}
        </div>)}
    </Modal>
  );
}
