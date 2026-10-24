import { fmtMoney, QtyInput } from "../r1/common";
import { money } from "../../config";
import type { Ing } from "./types";

export interface Line { key: string; ingredient_id: string; qty: number | null; unit_cost: string }
export const newLine = (n: number): Line => ({ key: `l${Date.now()}${n}`, ingredient_id: "", qty: null, unit_cost: "" });
export const linesPayload = (ls: Line[]) => ls.filter((l) => l.ingredient_id && l.qty && l.qty > 0).map((l) => ({ ingredient_id: Number(l.ingredient_id), qty: l.qty, unit_cost: Number((l.unit_cost || "0").replace(",", ".")) || 0 }));
export const linesTotal = (ls: Line[]) => ls.reduce((s, l) => s + (l.qty || 0) * (Number((l.unit_cost || "0").replace(",", ".")) || 0), 0);

/** Renglones insumo / cantidad / costo unitario, con el último costo pagado como sugerencia */
export default function LinesEditor({ lines, onChange, ings, showCost = true }: { lines: Line[]; onChange: (l: Line[]) => void; ings: Ing[]; showCost?: boolean }) {
  const upd = (i: number, p: Partial<Line>) => onChange(lines.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="rs-stack">
      {lines.map((l, i) => {
        const g = ings.find((x) => x.id === Number(l.ingredient_id));
        return (
          <div key={l.key} className="r1-row-edit" style={{ gridTemplateColumns: showCost ? "minmax(0,2fr) auto minmax(0,110px) auto" : "minmax(0,2fr) auto auto" }}>
            <select aria-label="Insumo" value={l.ingredient_id} onChange={(e) => { const ing = ings.find((x) => x.id === Number(e.target.value)); upd(i, { ingredient_id: e.target.value, qty: null, unit_cost: ing && ing.cost_last ? String(ing.cost_last) : "" }); }}>
              <option value="">Elegí un insumo</option>{ings.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {g ? <QtyInput key={g.id} value={l.qty} unit={g.unit} onChange={(v) => upd(i, { qty: v })} ariaLabel="Cantidad" /> : <span />}
            {showCost && <input aria-label={`Costo por ${g?.unit ?? "unidad"}`} placeholder={g ? `$ por ${g.unit}` : "Costo"} inputMode="decimal" value={l.unit_cost} onChange={(e) => upd(i, { unit_cost: e.target.value })} />}
            <button className="rs-link rs-link-danger" onClick={() => onChange(lines.filter((_, j) => j !== i))}>Quitar</button>
          </div>);
      })}
      {!lines.length && <div className="rs-empty">Agregá los insumos.</div>}
      <div className="rs-row" style={{ justifyContent: "space-between" }}>
        <button className="secondary-button" onClick={() => onChange([...lines, newLine(lines.length)])}>Agregar insumo</button>
        {showCost && <strong>Total: {fmtMoney(linesTotal(lines)) === "—" ? money(0) : money(linesTotal(lines))}</strong>}
      </div>
    </div>
  );
}
