import { useEffect, useMemo, useState } from "react";
import { appApi, money } from "../../config";
import { Field, Modal, Tabs, numOrNull, strOrNull } from "../ui";
import { ConfirmModal, LightPill } from "../r1/common";
import type { AllergenCat, Category, GlutenStatus, ModGroup, Notify, Product, Station, Variant } from "./types";
import { GLUTEN_LABEL, SIN_TACC_NOTICE } from "./types";

type Inner = "datos" | "variantes" | "alergenos" | "adicionales";
interface Props extends Notify {
  product: Product | null; defaultCategory?: number; cats: Category[]; stations: Station[]; groups: ModGroup[]; allergens: AllergenCat[];
  hasStock: boolean; onClose: () => void; reload: () => Promise<void> | void;
}

export default function ProductModal({ product, defaultCategory, cats, stations, groups, allergens, hasStock, onClose, reload, show, fail }: Props) {
  const [current, setCurrent] = useState<Product | null>(product);
  const [tab, setTab] = useState<Inner>("datos");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const [f, setF] = useState({
    name: product?.name ?? "", category_id: String(product?.category_id ?? defaultCategory ?? ""), price: product ? String(product.price) : "",
    description: product?.description ?? "", station_id: product?.station_id ? String(product.station_id) : "", image_url: product?.image_url ?? "",
    visible_salon: product?.visible_salon ?? true, visible_qr: product?.visible_qr ?? true, visible_delivery: product?.visible_delivery ?? true,
    alcohol: product?.alcohol ?? false, track_stock: product?.track_stock ?? true, active: product?.active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function refresh(id: number) {
    await reload();
    const all = await appApi<Product[]>("/products");
    setCurrent(all.find((p) => p.id === id) || null);
  }

  async function save() {
    setBusy(true);
    try {
      const body = {
        name: f.name, category_id: Number(f.category_id), price: numOrNull(f.price), description: strOrNull(f.description),
        station_id: f.station_id ? Number(f.station_id) : null, image_url: strOrNull(f.image_url), visible_salon: f.visible_salon,
        visible_qr: f.visible_qr, visible_delivery: f.visible_delivery, alcohol: f.alcohol, track_stock: f.track_stock, active: f.active,
      };
      if (current) {
        await appApi(`/products/${current.id}`, { method: "PUT", body });
        show("Producto guardado"); await refresh(current.id);
      } else {
        const p = await appApi<Product>("/products", { method: "POST", body });
        show("Producto creado: ahora podés cargar variantes y alérgenos"); setCurrent(p); await reload(); setTab("variantes");
      }
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function remove() {
    if (!current) return;
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/products/${current.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }

  const needSave = !current;
  return (
    <Modal eyebrow="PRODUCTO" title={current ? current.name : "Nuevo producto"} size="wide" onClose={onClose}
      footer={<>
        {current && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAskDelete(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        {tab === "datos" && <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : current ? "Guardar" : "Crear producto"}</button>}
      </>}>
      <div className="r1-tabs-inner">
        <Tabs value={tab} onChange={(t) => { if (!needSave || t === "datos") setTab(t); }}
          options={[["datos", "Datos"], ["variantes", "Variantes"], ["alergenos", "Alérgenos"], ["adicionales", "Adicionales"]]} />
      </div>
      {tab === "datos" && (
        <div className="r1-grid-form">
          <Field label="Nombre"><input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} /></Field>
          <Field label="Categoría">
            <select value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Elegí una</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Precio (con IVA)" hint="Si tiene variantes, es el precio base."><input inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Estación" hint="Si la dejás vacía usa la de la categoría.">
            <select value={f.station_id} onChange={(e) => set("station_id", e.target.value)}>
              <option value="">Por defecto</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Descripción" wide><textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={500} /></Field>
          <Field label="Foto (link)" wide><input value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." /></Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="rs-inline-checks">
              <label><input type="checkbox" checked={f.visible_salon} onChange={(e) => set("visible_salon", e.target.checked)} /> Se vende en salón y mostrador</label>
              <label><input type="checkbox" checked={f.visible_qr} onChange={(e) => set("visible_qr", e.target.checked)} /> Visible en el QR de la mesa</label>
              <label><input type="checkbox" checked={f.visible_delivery} onChange={(e) => set("visible_delivery", e.target.checked)} /> Delivery y take-away</label>
              <label><input type="checkbox" checked={f.alcohol} onChange={(e) => set("alcohol", e.target.checked)} /> Lleva alcohol</label>
              <label><input type="checkbox" checked={f.track_stock} onChange={(e) => set("track_stock", e.target.checked)} /> Descuenta stock</label>
              <label><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Activo</label>
            </div>
          </div>
          {current?.cost && hasStock && (
            <div className="rs-note rs-note-info" style={{ gridColumn: "1 / -1" }}>
              <div className="rs-row"><strong>Costo del plato:</strong> {current.cost.cost != null ? money(current.cost.cost) : "sin receta cargada"}
                <LightPill light={current.cost.light} pct={current.cost.food_cost_pct} />
                {current.cost.margin != null && <span>Ganancia {money(current.cost.margin)}</span>}</div>
              <small className="rs-hint">La receta se carga en Stock, pestaña «Recetas y costos».{current.cost.incomplete ? " Hay insumos de la receta sin costo: el número es parcial." : ""}</small>
            </div>
          )}
        </div>
      )}
      {tab === "variantes" && current && <VariantsEditor product={current} refresh={() => refresh(current.id)} show={show} fail={fail} />}
      {tab === "alergenos" && current && <AllergenEditor product={current} allergens={allergens} refresh={() => refresh(current.id)} show={show} fail={fail} />}
      {tab === "adicionales" && current && <GroupsPicker product={current} groups={groups} refresh={() => refresh(current.id)} show={show} fail={fail} />}
      {needSave && tab !== "datos" && <p className="rs-muted">Guardá el producto primero.</p>}
      {askDelete && current && <ConfirmModal title={`Borrar «${current.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAskDelete(false)} onConfirm={remove}>
        Si ya se vendió, no se borra: queda inactivo para conservar el historial.
      </ConfirmModal>}
    </Modal>
  );
}

function VariantsEditor({ product, refresh, show, fail }: Notify & { product: Product; refresh: () => Promise<void> }) {
  const [rows, setRows] = useState<{ id: number | null; name: string; price: string; is_default: boolean; recipe_factor: string }[]>([]);
  useEffect(() => {
    setRows(product.variants.map((v: Variant) => ({ id: v.id, name: v.name, price: v.price ? String(v.price) : "", is_default: v.is_default, recipe_factor: String(v.recipe_factor) })));
  }, [product.variants]);
  const upd = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  async function saveRow(i: number) {
    const r = rows[i];
    const body = { name: r.name, price: numOrNull(r.price) ?? 0, is_default: r.is_default, recipe_factor: numOrNull(r.recipe_factor) ?? 1 };
    try {
      if (r.id) await appApi(`/products/${product.id}/variants/${r.id}`, { method: "PUT", body });
      else await appApi(`/products/${product.id}/variants`, { method: "POST", body });
      show("Variante guardada"); await refresh();
    } catch (e) { fail(e); }
  }
  async function delRow(i: number) {
    const r = rows[i];
    if (!r.id) return setRows((x) => x.filter((_, j) => j !== i));
    try { await appApi(`/products/${product.id}/variants/${r.id}`, { method: "DELETE" }); show("Variante borrada"); await refresh(); } catch (e) { fail(e); }
  }
  return (
    <div>
      <p className="rs-muted">Tamaños o versiones (Simple / Doble, Chica / Grande). Precio en 0 = usa el del producto. El factor de receta multiplica los insumos (una doble lleva 2).</p>
      <div className="r1-rows">
        {rows.length > 0 && <div className="r1-row-head"><span>Nombre</span><span>Precio (0 = el del producto)</span><span>Factor de receta</span><span /></div>}
        {rows.map((r, i) => (
          <div key={r.id ?? `n${i}`} className="r1-row-edit r1-var-row">
            <input aria-label="Nombre de la variante" placeholder="Nombre" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <input aria-label="Precio" inputMode="decimal" placeholder="Precio" value={r.price} onChange={(e) => upd(i, { price: e.target.value })} />
            <input aria-label="Factor de receta" inputMode="decimal" placeholder="Factor" value={r.recipe_factor} onChange={(e) => upd(i, { recipe_factor: e.target.value })} />
            <div className="rs-row" style={{ gap: 6 }}>
              <label><input type="checkbox" checked={r.is_default} onChange={(e) => upd(i, { is_default: e.target.checked })} /> Base</label>
              <button className="primary-button" onClick={() => saveRow(i)} disabled={!r.name.trim()}>Guardar</button>
              <button className="rs-link rs-link-danger" onClick={() => delRow(i)}>Quitar</button>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <div className="rs-empty">Este producto no tiene variantes: se vende a {money(product.price)}.</div>}
      <button className="secondary-button" style={{ marginTop: 12 }} onClick={() => setRows((r) => [...r, { id: null, name: "", price: "", is_default: r.length === 0, recipe_factor: "1" }])}>Agregar variante</button>
    </div>
  );
}

export function AllergenEditor({ product, allergens, refresh, show, fail }: Notify & { product: Product; allergens: AllergenCat[]; refresh: () => Promise<void> }) {
  const init = useMemo(() => Object.fromEntries(product.allergens.map((a) => [a.code, a.level])) as Record<string, "CONTIENE" | "TRAZAS">, [product.allergens]);
  const [levels, setLevels] = useState<Record<string, "CONTIENE" | "TRAZAS" | "">>(init);
  const [declared, setDeclared] = useState(product.allergens_declared);
  const [gluten, setGluten] = useState<GlutenStatus>(product.gluten_status);
  const [vegan, setVegan] = useState(product.is_vegan);
  const [veg, setVeg] = useState(product.is_vegetarian);
  const [ack, setAck] = useState(product.gluten_status === "SIN_TACC_ELABORACION");
  const [busy, setBusy] = useState(false);
  const wantsTacc = gluten === "SIN_TACC_ELABORACION";

  function setLevel(code: string, lvl: "CONTIENE" | "TRAZAS" | "") {
    setLevels((l) => ({ ...l, [code]: lvl }));
    if (code === "gluten" && lvl === "CONTIENE") setGluten("CONTIENE");
  }
  async function save() {
    setBusy(true);
    try {
      await appApi(`/products/${product.id}/allergens`, { method: "PUT", body: {
        allergens: Object.entries(levels).filter(([, l]) => l).map(([code, level]) => ({ code, level })),
        gluten_status: gluten, allergens_declared: declared, is_vegan: vegan, is_vegetarian: veg || vegan,
      } });
      show("Alérgenos guardados"); await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  return (
    <div className="rs-stack">
      <div className="rs-note rs-note-info">Marcá lo que lleva el plato (contiene) o lo que puede tener por la cocina (trazas). La información la declara el local.</div>
      <div>
        {allergens.map((a) => (
          <div key={a.code} className="r1-allergen-row">
            <strong style={{ fontSize: 14 }}>{a.name}</strong>
            <div className="r1-chips" role="radiogroup" aria-label={a.name}>
              {([["", "No"], ["CONTIENE", "Contiene"], ["TRAZAS", "Trazas"]] as const).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={(levels[a.code] || "") === k}
                  className={`r1-chip ${(levels[a.code] || "") === k ? (k === "TRAZAS" ? "is-on-warn" : "is-on") : ""}`} onClick={() => setLevel(a.code, k)}>{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rs-inline-checks">
        <label><input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} /> Ya declaré los alérgenos de este plato (aunque no tenga ninguno)</label>
        <label><input type="checkbox" checked={vegan} onChange={(e) => setVegan(e.target.checked)} /> Vegano</label>
        <label><input type="checkbox" checked={veg || vegan} disabled={vegan} onChange={(e) => setVeg(e.target.checked)} /> Vegetariano</label>
      </div>
      <Field label="Gluten / TACC">
        <select value={gluten} onChange={(e) => { setGluten(e.target.value as GlutenStatus); setAck(false); }}>
          {(Object.keys(GLUTEN_LABEL) as GlutenStatus[]).map((k) => <option key={k} value={k}>{GLUTEN_LABEL[k]}</option>)}
        </select>
      </Field>
      {wantsTacc && (
        <div className="r1-notice">
          <p style={{ margin: "0 0 8px" }}>{SIN_TACC_NOTICE}</p>
          <label className="rs-row" style={{ gap: 8, fontWeight: 700 }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Entiendo y lo declaro bajo mi responsabilidad</label>
        </div>
      )}
      <div><button className="primary-button" onClick={save} disabled={busy || (wantsTacc && !ack)}>{busy ? "Guardando..." : "Guardar alérgenos"}</button></div>
    </div>
  );
}

function GroupsPicker({ product, groups, refresh, show, fail }: Notify & { product: Product; groups: ModGroup[]; refresh: () => Promise<void> }) {
  const [ids, setIds] = useState<number[]>(product.group_ids);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await appApi(`/products/${product.id}/modifier-groups`, { method: "PUT", body: { group_ids: ids } }); show("Adicionales guardados"); await refresh(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  if (!groups.length) return <div className="rs-empty">Todavía no creaste grupos de adicionales. Armalos en la pestaña «Adicionales» (Ej: Punto de cocción, Extras).</div>;
  return (
    <div className="rs-stack">
      <p className="rs-muted">Elegí qué opciones se ofrecen al pedir este producto.</p>
      <div className="rs-inline-checks" style={{ flexDirection: "column", gap: 10 }}>
        {groups.map((g) => (
          <label key={g.id}><input type="checkbox" checked={ids.includes(g.id)} onChange={(e) => setIds((x) => e.target.checked ? [...x, g.id] : x.filter((i) => i !== g.id))} />
            <span><strong>{g.name}</strong> <span className="rs-muted">· {g.options.map((o) => o.name).join(", ") || "sin opciones"}</span></span></label>
        ))}
      </div>
      <div><button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar adicionales"}</button></div>
    </div>
  );
}
