// Piezas compartidas por Delivery, la carta pública, el pedido en mesa y el pedido online.
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { money, addDays, dayKey, parseDay, longDate } from "../../config";
import { Empty, Field, Modal } from "../ui";
import { cartTotal, checkOptions, lineKey, unitPrice } from "./types";
import type { CartLine, MenuCategory, MenuProduct } from "./types";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function needsChoices(p: MenuProduct): boolean {
  return p.modifier_groups.length > 0 || p.variants.length > 1;
}

/** Selector de día con flechas */
export function DateNav({ day, onChange }: { day: string; onChange: (d: string) => void }) {
  const d = parseDay(day);
  return (
    <div className="r3-datenav">
      <button type="button" className="r2-mini" onClick={() => onChange(dayKey(addDays(d, -1)))} aria-label="Día anterior">‹</button>
      <input type="date" value={day} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Día" />
      <button type="button" className="r2-mini" onClick={() => onChange(dayKey(addDays(d, 1)))} aria-label="Día siguiente">›</button>
      <span className="r3-datenav-label">{longDate(d)}</span>
    </div>
  );
}

/** Barras horizontales simples (valor mostrado al lado) */
export function BarList({ rows, format, empty }: { rows: { label: string; value: number; sub?: ReactNode }[]; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="r2-muted">{empty || "Sin datos en este período."}</p>;
  return (
    <ul className="r3-bars">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="r3-bars-top"><span>{r.label}</span><b>{(format || ((n) => String(n)))(r.value)}</b></div>
          <div className="r3-bars-track"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
          {r.sub && <small>{r.sub}</small>}
        </li>
      ))}
    </ul>
  );
}

/** Carta para armar un pedido: buscador, categorías y botones */
export function MenuPicker({ categories, onPick, query: q0 }: { categories: MenuCategory[]; onPick: (p: MenuProduct) => void; query?: boolean }) {
  const [cat, setCat] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = norm(query.trim());
    const out: MenuProduct[] = [];
    for (const c of categories) {
      if (cat !== "all" && c.id !== cat) continue;
      for (const p of c.products) if (!q || norm(p.name).includes(q)) out.push(p);
    }
    return out;
  }, [categories, cat, query]);
  if (!categories.length) return <Empty title="La carta está vacía">Cargá productos en Carta para poder pedir.</Empty>;
  return (
    <div className="r2-menu-picker">
      {q0 !== false && <input className="rs-search" type="search" placeholder="Buscar un plato o bebida" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar en la carta" />}
      <div className="r2-cats" role="tablist" aria-label="Categorías">
        <button type="button" role="tab" className={cat === "all" ? "is-on" : ""} onClick={() => setCat("all")}>Todo</button>
        {categories.map((c) => <button key={c.id} type="button" role="tab" className={cat === c.id ? "is-on" : ""} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>
      {list.length === 0 ? <p className="r2-muted">No encontramos nada con ese nombre.</p> : (
        <div className="r2-products">
          {list.map((p) => (
            <button key={p.id} type="button" className={`r2-product ${p.orderable ? "" : "is-out"}`} disabled={!p.orderable} onClick={() => onPick(p)}>
              <strong>{p.name}</strong>
              <span className="r2-product-price">{p.sold_out ? "Agotado" : <>{p.variants.length > 1 ? "Desde " : ""}{money(p.variants.length > 1 ? Math.min(...p.variants.map((v) => v.price)) : p.price_now)}</>}</span>
              <span className="r2-product-tags">
                {p.sin_tacc && <span className="r2-tag r2-tag-green">Sin TACC</span>}
                {p.vegan && <span className="r2-tag r2-tag-green">Vegano</span>}
                {!p.vegan && p.vegetarian && <span className="r2-tag r2-tag-green">Vegetariano</span>}
                {p.alcohol && <span className="r2-tag r2-tag-orange">Alcohol</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ventana para un plato con tamaño, adicionales, cantidad y nota */
export function LineDialog({ product, onClose, onAdd, noteLabel }: {
  product: MenuProduct; onClose: () => void; onAdd: (line: CartLine) => void; noteLabel?: string;
}) {
  const def = product.variants.find((v) => v.is_default) || product.variants[0] || null;
  const [variant, setVariant] = useState<number | null>(def ? def.id : null);
  const [picked, setPicked] = useState<number[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const unit = unitPrice(product, variant, picked);

  function toggle(groupId: number, optionId: number, max: number) {
    const group = product.modifier_groups.find((g) => g.id === groupId);
    if (!group) return;
    setPicked((cur) => {
      if (cur.includes(optionId)) return cur.filter((x) => x !== optionId);
      const ids = group.options.map((o) => o.id);
      const inGroup = cur.filter((x) => ids.includes(x));
      if (max === 1) return [...cur.filter((x) => !ids.includes(x)), optionId];
      if (max > 0 && inGroup.length >= max) return cur;
      return [...cur, optionId];
    });
  }
  function submit() {
    const err = checkOptions(product, picked);
    if (err) { setError(err); return; }
    const vname = product.variants.find((v) => v.id === variant)?.name;
    const names = product.modifier_groups.flatMap((g) => g.options).filter((o) => picked.includes(o.id)).map((o) => o.name);
    onAdd({
      key: lineKey(product.id, variant, picked, notes), product_id: product.id, variant_id: variant, option_ids: picked, qty, notes: notes.trim(),
      name: product.name, detail: [vname && product.variants.length > 1 ? vname : "", ...names].filter(Boolean).join(" · "), unit,
    });
  }
  return (
    <Modal title={product.name} eyebrow="Agregar al pedido" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={submit}>Agregar · {money(unit * qty)}</button></>}>
      <div className="r2-dialog">
        {product.description && <p className="r2-muted">{product.description}</p>}
        {product.allergen_text && <p className="r2-allergen-line">{product.allergen_text}</p>}
        {product.variants.length > 1 && (
          <fieldset className="r2-fieldset"><legend>Tamaño</legend>
            <div className="r2-options">
              {product.variants.map((v) => (
                <label key={v.id} className={`r2-option ${variant === v.id ? "is-on" : ""}`}>
                  <input type="radio" name="variant" checked={variant === v.id} onChange={() => setVariant(v.id)} /><span>{v.name}</span><b>{money(v.price)}</b>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {product.modifier_groups.map((g) => (
          <fieldset key={g.id} className="r2-fieldset">
            <legend>{g.name} <em>{g.required || g.min > 0 ? "(obligatorio)" : "(opcional)"}{g.max > 0 ? ` · hasta ${g.max}` : ""}</em></legend>
            <div className="r2-options">
              {g.options.map((o) => (
                <label key={o.id} className={`r2-option ${picked.includes(o.id) ? "is-on" : ""}`}>
                  <input type={g.max === 1 ? "radio" : "checkbox"} name={`g${g.id}`} checked={picked.includes(o.id)} onChange={() => toggle(g.id, o.id, g.max)} />
                  <span>{o.name}</span>{o.price_delta ? <b>+{money(o.price_delta)}</b> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <Field label={noteLabel || "Aclaración (opcional)"}><input value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Sin cebolla, bien cocido..." /></Field>
        <div className="r2-dialog-row">
          <div className="r2-stepper"><button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Menos">−</button><strong>{qty}</strong><button type="button" onClick={() => setQty(Math.min(50, qty + 1))} aria-label="Más">+</button></div>
        </div>
        {error && <div className="rs-note rs-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

/** Lista del pedido que se está armando */
export function CartList({ lines, onQty, onRemove, extra }: {
  lines: CartLine[]; onQty: (key: string, qty: number) => void; onRemove: (key: string) => void; extra?: { label: string; amount: number }[];
}) {
  if (!lines.length) return <p className="r2-muted">Todavía no agregaste nada.</p>;
  const sub = cartTotal(lines);
  const total = sub + (extra || []).reduce((a, e) => a + e.amount, 0);
  return (
    <div className="r3-cart">
      {lines.map((l) => (
        <div key={l.key} className="r3-cart-line">
          <div><strong>{l.name}</strong>{l.detail && <small>{l.detail}</small>}{l.notes && <small className="r3-note-line">{l.notes}</small>}</div>
          <div className="r3-cart-side">
            <span className="r2-mini-step"><button type="button" onClick={() => onQty(l.key, l.qty - 1)} aria-label="Menos">−</button><span>{l.qty}</span><button type="button" onClick={() => onQty(l.key, l.qty + 1)} aria-label="Más">+</button></span>
            <b className="r2-money">{money(l.unit * l.qty)}</b>
            <button type="button" className="r2-mini is-danger" onClick={() => onRemove(l.key)} aria-label={`Quitar ${l.name}`}>Quitar</button>
          </div>
        </div>
      ))}
      {(extra || []).map((e, i) => <div key={i} className="r3-cart-extra"><span>{e.label}</span><b className="r2-money">{money(e.amount)}</b></div>)}
      <div className="r3-cart-total"><span>Total</span><b className="r2-money">{money(total)}</b></div>
    </div>
  );
}

/** Estado del carrito reutilizable */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const add = (l: CartLine) => setLines((cur) => {
    const hit = cur.find((x) => x.key === l.key);
    return hit ? cur.map((x) => (x.key === l.key ? { ...x, qty: Math.min(50, x.qty + l.qty) } : x)) : [...cur, l];
  });
  const setQty = (key: string, qty: number) => setLines((cur) => (qty <= 0 ? cur.filter((x) => x.key !== key) : cur.map((x) => (x.key === key ? { ...x, qty: Math.min(50, qty) } : x))));
  const remove = (key: string) => setLines((cur) => cur.filter((x) => x.key !== key));
  const clear = () => setLines([]);
  return { lines, add, setQty, remove, clear };
}
