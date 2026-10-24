import { useMemo, useState } from "react";
import { money } from "../../config";
import { Field, Modal } from "../ui";
import { COURSE_NAMES } from "./types";
import type { ItemIn, MenuProduct } from "./types";

/**
 * Ventana para pedir un plato con opciones: tamaño, adicionales (respetando mínimo y máximo de cada grupo),
 * huecos del combo, cantidad, nota para cocina, tiempo y alerta de alergia.
 */
export default function ItemDialog({ product, defaultCourse, allergyDefault, allowCourses, alcoholNotice, onClose, onAdd }: {
  product: MenuProduct; defaultCourse: number; allergyDefault: boolean; allowCourses: boolean; alcoholNotice?: string;
  onClose: () => void; onAdd: (item: ItemIn) => void;
}) {
  const defVariant = product.variants.find((v) => v.is_default) || product.variants[0] || null;
  const [variant, setVariant] = useState<number | null>(defVariant ? defVariant.id : null);
  const [picked, setPicked] = useState<Record<number, number[]>>({});
  const [combo, setCombo] = useState<Record<number, number>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [course, setCourse] = useState(defaultCourse);
  const [allergy, setAllergy] = useState(allergyDefault);
  const [error, setError] = useState("");

  const variantObj = product.variants.find((v) => v.id === variant) || null;
  const base = variantObj ? variantObj.price_now : product.price_now;

  const extras = useMemo(() => {
    let sum = 0;
    for (const g of product.modifier_groups) for (const o of g.options) if ((picked[g.id] || []).includes(o.id)) sum += o.price_delta;
    for (const s of product.combo_slots) {
      const o = s.options.find((x) => x.product_id === combo[s.id]);
      if (o) sum += o.surcharge;
    }
    return sum;
  }, [product, picked, combo]);

  function toggle(groupId: number, optionId: number, max: number) {
    setPicked((cur) => {
      const now = cur[groupId] || [];
      if (now.includes(optionId)) return { ...cur, [groupId]: now.filter((x) => x !== optionId) };
      if (max <= 1) return { ...cur, [groupId]: [optionId] };
      if (max > 0 && now.length >= max) return cur;
      return { ...cur, [groupId]: [...now, optionId] };
    });
  }

  function submit() {
    for (const g of product.modifier_groups) {
      const n = (picked[g.id] || []).length;
      const need = Math.max(g.min_select || 0, g.required ? 1 : 0);
      if (n < need) { setError(`Elegí ${g.name}`); return; }
    }
    for (const s of product.combo_slots) if (!combo[s.id]) { setError(`Elegí ${s.name} del combo`); return; }
    onAdd({
      product_id: product.id, variant_id: variant, qty, modifier_option_ids: Object.values(picked).flat(),
      combo_choices: product.combo_slots.map((s) => ({ slot_id: s.id, product_id: combo[s.id] })),
      notes: notes.trim() || null, course, allergy_alert: allergy,
    });
  }

  return (
    <Modal eyebrow="AGREGAR A LA COMANDA" title={product.name} onClose={onClose}
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={submit}>Agregar · {money((base + extras) * qty)}</button>
      </>}>
      <div className="product-form r2-dialog">
        {product.description && <p className="rs-muted" style={{ margin: 0 }}>{product.description}</p>}
        <p className="r2-allergen-line">{product.allergen_text}{product.sin_tacc ? " · Sin TACC declarado por el local" : ""}</p>
        {product.alcohol && <div className="rs-note rs-note-warn"><strong>Verificá la edad.</strong> {alcoholNotice || "Prohibida la venta de alcohol a menores de 18 años"}</div>}

        {product.variants.length > 1 && (
          <fieldset className="r2-fieldset">
            <legend>Tamaño</legend>
            <div className="r2-options">
              {product.variants.map((v) => (
                <label key={v.id} className={`r2-option ${variant === v.id ? "is-on" : ""}`}>
                  <input type="radio" name="variant" checked={variant === v.id} onChange={() => setVariant(v.id)} />
                  <span>{v.name}</span><b>{money(v.price_now)}</b>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {product.modifier_groups.map((g) => (
          <fieldset key={g.id} className="r2-fieldset">
            <legend>{g.name}{(g.required || g.min_select > 0) ? <em> · obligatorio</em> : <em> · opcional</em>}{g.max_select > 1 ? <em> · hasta {g.max_select}</em> : null}</legend>
            <div className="r2-options">
              {g.options.map((o) => {
                const on = (picked[g.id] || []).includes(o.id);
                return (
                  <label key={o.id} className={`r2-option ${on ? "is-on" : ""}`}>
                    <input type={g.max_select === 1 ? "radio" : "checkbox"} name={`g${g.id}`} checked={on} onChange={() => toggle(g.id, o.id, g.max_select)} />
                    <span>{o.name}</span>{o.price_delta ? <b>{o.price_delta > 0 ? "+" : ""}{money(o.price_delta)}</b> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        {product.combo_slots.map((s) => (
          <fieldset key={s.id} className="r2-fieldset">
            <legend>{s.name}<em> · obligatorio</em></legend>
            <div className="r2-options">
              {s.options.map((o) => (
                <label key={o.id} className={`r2-option ${combo[s.id] === o.product_id ? "is-on" : ""} ${o.sold_out ? "is-out" : ""}`}>
                  <input type="radio" name={`s${s.id}`} disabled={o.sold_out} checked={combo[s.id] === o.product_id} onChange={() => setCombo((c) => ({ ...c, [s.id]: o.product_id }))} />
                  <span>{o.name}{o.sold_out ? " (agotado)" : ""}</span>{o.surcharge ? <b>+{money(o.surcharge)}</b> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="r2-dialog-row">
          <Field label="Cantidad">
            <div className="r2-stepper">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
              <strong>{qty}</strong>
              <button type="button" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Más">+</button>
            </div>
          </Field>
          {allowCourses && (
            <Field label="Tiempo" hint="El tiempo 2 y 3 salen cuando marchás.">
              <div className="rs-seg">
                {[1, 2, 3].map((c) => <button key={c} type="button" className={course === c ? "is-on" : ""} onClick={() => setCourse(c)}>{COURSE_NAMES[c]}</button>)}
              </div>
            </Field>
          )}
        </div>
        <Field label="Nota para cocina (opcional)"><input value={notes} maxLength={255} onChange={(e) => setNotes(e.target.value)} placeholder="Sin sal, punto cocido, sin cebolla…" /></Field>
        <div className="rs-inline-checks">
          <label><input type="checkbox" checked={allergy} onChange={(e) => setAllergy(e.target.checked)} /> Alergia o celiaquía: avisar a cocina en rojo</label>
        </div>
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
