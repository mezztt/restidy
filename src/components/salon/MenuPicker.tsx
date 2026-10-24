import { useMemo, useState } from "react";
import { money } from "../../config";
import { Empty } from "../ui";
import type { MenuCategory, MenuProduct } from "./types";

/** Cuántas opciones tiene que elegir la persona antes de agregar (si no hay ninguna, se agrega de un toque) */
export function needsChoices(p: MenuProduct): boolean {
  return p.kind === "COMBO" || p.modifier_groups.length > 0 || p.variants.length > 1;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Carta para tomar el pedido: buscador, categorías y botones grandes. Los agotados se ven pero no se pueden pedir. */
export default function MenuPicker({ categories, onPick, disabled }: {
  categories: MenuCategory[]; onPick: (p: MenuProduct) => void; disabled?: boolean;
}) {
  const [cat, setCat] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [onlyTacc, setOnlyTacc] = useState(false);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    const list: MenuProduct[] = [];
    for (const c of categories) {
      if (cat !== "all" && c.id !== cat) continue;
      for (const p of c.products) {
        if (q && !norm(p.name).includes(q)) continue;
        if (onlyTacc && !p.sin_tacc) continue;
        list.push(p);
      }
    }
    return list;
  }, [categories, cat, query, onlyTacc]);

  if (categories.length === 0) {
    return <Empty title="La carta está vacía">Cargá categorías y productos en la sección Carta para empezar a vender.</Empty>;
  }

  return (
    <div className="r2-menu-picker">
      <div className="r2-menu-tools">
        <input className="rs-search" type="search" placeholder="Buscar un plato o bebida" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar en la carta" />
        <label className="r2-check"><input type="checkbox" checked={onlyTacc} onChange={(e) => setOnlyTacc(e.target.checked)} /> Solo sin TACC</label>
      </div>
      <div className="r2-cats" role="tablist" aria-label="Categorías">
        <button type="button" role="tab" className={cat === "all" ? "is-on" : ""} onClick={() => setCat("all")}>Todo</button>
        {categories.map((c) => (
          <button key={c.id} type="button" role="tab" className={cat === c.id ? "is-on" : ""} onClick={() => setCat(c.id)}>{c.name}</button>
        ))}
      </div>
      {visible.length === 0 ? <Empty title="No encontramos nada">Probá con otra palabra o quitá el filtro.</Empty> : (
        <div className="r2-products">
          {visible.map((p) => (
            <button key={p.id} type="button" className={`r2-product ${p.sold_out ? "is-out" : ""}`} disabled={disabled || p.sold_out}
              onClick={() => onPick(p)} aria-label={`${p.name}, ${money(p.price_now)}${p.sold_out ? ", agotado" : ""}`}>
              <strong>{p.name}</strong>
              <span className="r2-product-price">
                {p.variants.length > 1 ? `desde ${money(Math.min(...p.variants.map((v) => v.price_now)))}` : money(p.price_now)}
                {p.price_rule && <em title={p.price_rule}>{p.price_rule}</em>}
              </span>
              <span className="r2-product-tags">
                {p.sold_out && <b className="r2-tag r2-tag-red">Agotado</b>}
                {p.sin_tacc && <b className="r2-tag r2-tag-green">Sin TACC</b>}
                {p.alcohol && <b className="r2-tag r2-tag-gray">+18</b>}
                {(needsChoices(p)) && !p.sold_out && <b className="r2-tag r2-tag-gray">Opciones</b>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
