import { fmtMoney, QtyInput } from "../r1/common";
import type { Ingredient, Recipe } from "./types";

export interface RItem { key: string; ref: string; qty: number | null; waste: string }   // ref: "i:12" o "s:3"

export function itemsFromRecipe(r: Recipe | undefined): RItem[] {
  return (r?.items ?? []).map((it, n) => ({ key: `k${n}`, ref: it.ingredient_id ? `i:${it.ingredient_id}` : `s:${it.sub_recipe_id}`, qty: it.qty, waste: it.waste_pct ? String(it.waste_pct) : "" }));
}
export function itemsToPayload(items: RItem[]) {
  return items.filter((i) => i.ref && i.qty && i.qty > 0).map((i) => ({
    ingredient_id: i.ref.startsWith("i:") ? Number(i.ref.slice(2)) : null, sub_recipe_id: i.ref.startsWith("s:") ? Number(i.ref.slice(2)) : null,
    qty: i.qty, waste_pct: Number((i.waste || "0").replace(",", ".")) || 0 }));
}

/** Renglones de una receta: insumo o preparación, cantidad (con g/ml) y merma de limpieza */
export default function RecipeItemsEditor({ items, onChange, ingredients, preps, yieldQty = 1 }: { items: RItem[]; onChange: (v: RItem[]) => void; ingredients: Ingredient[]; preps: Recipe[]; yieldQty?: number }) {
  const unitOf = (ref: string) => ref.startsWith("i:") ? ingredients.find((i) => i.id === Number(ref.slice(2)))?.unit ?? "u" : preps.find((p) => p.id === Number(ref.slice(2)))?.yield_unit ?? "porción";
  const costOf = (it: RItem) => {
    if (!it.qty) return null;
    const k = 1 - Math.min(Number(it.waste.replace(",", ".")) || 0, 99) / 100;
    if (it.ref.startsWith("i:")) { const g = ingredients.find((i) => i.id === Number(it.ref.slice(2))); return g ? it.qty * g.cost_avg / k : null; }
    const p = preps.find((x) => x.id === Number(it.ref.slice(2)));
    return p && p.cost != null ? (it.qty * p.cost) / k : null;
  };
  const upd = (i: number, p: Partial<RItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const total = items.reduce((s, it) => s + (costOf(it) ?? 0), 0) / (yieldQty || 1);
  return (
    <div className="rs-stack">
      {items.map((it, i) => (
        <div key={it.key} className="r1-row-edit" style={{ gridTemplateColumns: "minmax(0,2fr) auto minmax(0,90px) minmax(0,80px) auto" }}>
          <select aria-label="Insumo" value={it.ref} onChange={(e) => upd(i, { ref: e.target.value, qty: null })}>
            <option value="">Elegí un insumo</option>
            <optgroup label="Insumos">{ingredients.filter((g) => g.active).map((g) => <option key={g.id} value={`i:${g.id}`}>{g.name}</option>)}</optgroup>
            {preps.length > 0 && <optgroup label="Preparaciones">{preps.map((p) => <option key={p.id} value={`s:${p.id}`}>{p.name}</option>)}</optgroup>}
          </select>
          {it.ref ? <QtyInput key={it.ref} value={it.qty} unit={unitOf(it.ref)} onChange={(v) => upd(i, { qty: v })} ariaLabel="Cantidad" /> : <span />}
          <input aria-label="Merma de limpieza (%)" placeholder="Merma %" inputMode="decimal" value={it.waste} onChange={(e) => upd(i, { waste: e.target.value })} />
          <span className="r1-price" style={{ fontSize: 13 }}>{costOf(it) != null ? fmtMoney(costOf(it)) : "—"}</span>
          <button className="rs-link rs-link-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>Quitar</button>
        </div>
      ))}
      {!items.length && <div className="rs-empty">Todavía no hay renglones.</div>}
      <div className="rs-row" style={{ justifyContent: "space-between" }}>
        <button className="secondary-button" onClick={() => onChange([...items, { key: `k${Date.now()}${items.length}`, ref: "", qty: null, waste: "" }])}>Agregar renglón</button>
        <strong>Costo estimado por porción: {fmtMoney(total)}</strong>
      </div>
    </div>
  );
}
