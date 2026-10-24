import { useMemo, useState } from "react";
import { appApi, money } from "../../config";
import { Pill } from "../ui";
import { EmptyAction, LightPill } from "../r1/common";
import type { AllergenCat, Category, ModGroup, Notify, Product, Station } from "./types";
import ProductModal from "./ProductModal";
import CategoryManager from "./CategoryManager";
import SoldOutModal from "./SoldOutModal";

interface Props extends Notify {
  cats: Category[]; prods: Product[]; stations: Station[]; groups: ModGroup[]; allergens: AllergenCat[];
  canEdit: boolean; hasStock: boolean; reload: () => Promise<void> | void;
}

export default function ProductsTab({ cats, prods, stations, groups, allergens, canEdit, hasStock, reload, show, fail }: Props) {
  const [catId, setCatId] = useState<number | 0>(0);
  const [q, setQ] = useState("");
  const [onlyOut, setOnlyOut] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [outFor, setOutFor] = useState<Product | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return prods.filter((p) => p.kind === "SIMPLE" && (!catId || p.category_id === catId) && (!onlyOut || p.sold_out)
      && (!term || p.name.toLowerCase().includes(term) || (p.description || "").toLowerCase().includes(term)));
  }, [prods, catId, q, onlyOut]);
  const visibleCats = canEdit ? cats : cats.filter((c) => c.active);
  const countOf = (id: number) => prods.filter((p) => p.kind === "SIMPLE" && p.category_id === id && (canEdit || p.active)).length;

  async function reactivate(p: Product) {
    try { await appApi(`/products/${p.id}/sold-out`, { method: "PATCH", body: { sold_out: false } }); show(`${p.name} vuelve a estar disponible`); await reload(); } catch (e) { fail(e); }
  }

  if (!cats.length && !canEdit) return <EmptyAction title="Todavía no hay carta" text="Cuando el administrador cargue los productos los vas a ver acá." />;

  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-filters">
          <input className="rs-search" placeholder="Buscar producto..." aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
          <label><input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} /> Solo agotados</label>
        </div>
        <div className="rs-row">
          <a className="secondary-button" href="/print/carta" target="_blank" rel="noreferrer" style={{ textDecoration: "none", padding: "10px 16px", borderRadius: 12 }}>Imprimir carta</a>
          {canEdit && <button className="primary-button" disabled={!cats.length} onClick={() => setEditing("new")}>Nuevo producto</button>}
        </div>
      </div>
      <div className="r1-split">
        <div className="r1-side" aria-label="Categorías">
          <button className={catId === 0 ? "is-on" : ""} onClick={() => setCatId(0)}>Toda la carta <small>{prods.filter((p) => p.kind === "SIMPLE" && (canEdit || p.active)).length}</small></button>
          {visibleCats.map((c) => (
            <button key={c.id} className={`${catId === c.id ? "is-on" : ""} ${c.active ? "" : "is-off"}`} onClick={() => setCatId(c.id)}>{c.name} <small>{countOf(c.id)}</small></button>
          ))}
          {canEdit && <div className="r1-side-foot"><button onClick={() => setCatsOpen(true)}>Editar categorías</button></div>}
        </div>
        <div className="rs-card" style={{ padding: 0 }}>
          {!cats.length ? (
            <EmptyAction title="Empezá por una categoría" text="Las categorías ordenan la carta (Entradas, Platos, Bebidas…) y definen a qué estación va cada plato." action="Crear categorías" onAction={() => setCatsOpen(true)} />
          ) : !list.length ? (
            prods.length === 0 ? <EmptyAction title="Todavía no cargaste productos" text="Cargá el primero y completá variantes, alérgenos y adicionales cuando quieras." action={canEdit ? "Nuevo producto" : undefined} onAction={() => setEditing("new")} />
              : <EmptyAction title="No hay productos con ese filtro" text="Probá con otra búsqueda o categoría." />
          ) : list.map((p) => (
            <div key={p.id} className={`r1-prod ${p.sold_out ? "is-out" : ""} ${p.active ? "" : "is-inactive"}`}>
              <div className="r1-prod-main">
                <strong>{p.name}</strong>
                <small>{cats.find((c) => c.id === p.category_id)?.name}{p.description ? ` · ${p.description}` : ""}</small>
                <div className="r1-prod-badges">
                  {p.sold_out && <Pill tone="red">Agotado{p.sold_out_until ? " (temporal)" : ""}</Pill>}
                  {!p.active && <Pill tone="gray">Inactivo</Pill>}
                  {p.sin_tacc && <Pill tone="green">Sin TACC</Pill>}
                  {p.gluten_status === "CONTIENE" && <Pill tone="gray">Con gluten</Pill>}
                  {p.is_vegan ? <Pill tone="green">Vegano</Pill> : p.is_vegetarian ? <Pill tone="green">Vegetariano</Pill> : null}
                  {p.alcohol && <Pill tone="violet">Alcohol</Pill>}
                  {p.variants.length > 0 && <Pill tone="blue">{p.variants.length} variantes</Pill>}
                  {p.price_rule && <Pill tone="orange">{p.price_rule}</Pill>}
                  {!p.allergens_declared && <Pill tone="gray">Alérgenos sin declarar</Pill>}
                </div>
              </div>
              <div className="r1-prod-side">
                <span className="r1-price">{p.price_rule && <s>{money(p.price)}</s>}{money(p.price_now)}</span>
                {p.cost && <LightPill light={p.cost.light} pct={p.cost.food_cost_pct} />}
                {p.sold_out
                  ? <button className="secondary-button" onClick={() => reactivate(p)}>Reactivar</button>
                  : <button className="secondary-button" onClick={() => setOutFor(p)}>Se acabó</button>}
                {canEdit && <button className="secondary-button" onClick={() => setEditing(p)}>Editar</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {editing && <ProductModal product={editing === "new" ? null : editing} defaultCategory={catId || cats[0]?.id} cats={cats} stations={stations} groups={groups}
        allergens={allergens} hasStock={hasStock} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
      {catsOpen && <CategoryManager cats={cats} stations={stations} onClose={() => setCatsOpen(false)} reload={reload} show={show} fail={fail} />}
      {outFor && <SoldOutModal product={outFor} onClose={() => setOutFor(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}
