import { useMemo, useState } from "react";
import { Modal, Pill } from "../ui";
import { EmptyAction } from "../r1/common";
import type { AllergenCat, Category, Notify, Product } from "./types";
import { AllergenEditor } from "./ProductModal";
import { appApi } from "../../config";

type Filter = "todos" | "tacc" | "sin_declarar";

export default function AllergenMatrix({ prods, cats, allergens, canEdit, reload, show, fail }: Notify & {
  prods: Product[]; cats: Category[]; allergens: AllergenCat[]; canEdit: boolean; reload: () => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const list = useMemo(() => prods.filter((p) => p.active && p.kind === "SIMPLE"
    && (filter === "todos" || (filter === "tacc" ? p.sin_tacc : !p.allergens_declared)) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))), [prods, filter, q]);

  async function refreshEditing() {
    await reload();
    if (editing) { const all = await appApi<Product[]>("/products"); setEditing(all.find((p) => p.id === editing.id) || null); }
  }
  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-filters">
          <input className="rs-search" placeholder="Buscar producto..." aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filtro" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="todos">Todos los productos</option><option value="tacc">Solo sin TACC</option><option value="sin_declarar">Sin declarar</option>
          </select>
        </div>
        <span className="rs-muted">C = contiene · T = puede tener trazas</span>
      </div>
      {!list.length ? <div className="rs-card"><EmptyAction title="No hay productos para mostrar" text={filter === "todos" ? "Cargá productos para declarar sus alérgenos." : "Ningún producto cumple ese filtro."} /></div> : (
        <div className="rs-table-wrap"><table className="rs-table r1-matrix">
          <thead><tr><th>Producto</th>{allergens.map((a) => <th key={a.code} title={a.name}>{a.name.slice(0, 5)}</th>)}<th>Gluten</th>{canEdit && <th></th>}</tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong><small>{cats.find((c) => c.id === p.category_id)?.name}{!p.allergens_declared ? " · sin declarar" : ""}</small></td>
              {allergens.map((a) => { const l = p.allergens.find((x) => x.code === a.code)?.level;
                return <td key={a.code} className={l === "CONTIENE" ? "c-yes" : l === "TRAZAS" ? "c-trace" : "c-none"} aria-label={`${a.name}: ${l === "CONTIENE" ? "contiene" : l === "TRAZAS" ? "trazas" : "no"}`}>{l === "CONTIENE" ? "C" : l === "TRAZAS" ? "T" : "·"}</td>; })}
              <td>{p.sin_tacc ? <Pill tone="green">Sin TACC</Pill> : p.gluten_status === "CONTIENE" ? <Pill tone="gray">Con gluten</Pill> : <Pill tone="gray">Sin declarar</Pill>}</td>
              {canEdit && <td><button className="secondary-button" onClick={() => setEditing(p)}>Declarar</button></td>}
            </tr>))}</tbody>
        </table></div>
      )}
      <p className="rs-muted" style={{ marginTop: 10 }}>Los alérgenos y la marca «sin TACC» los declara el local. Restidy no certifica que un plato sea apto para celíacos o alérgicos.</p>
      {editing && <Modal eyebrow="ALÉRGENOS" title={editing.name} size="wide" onClose={() => setEditing(null)} footer={<button className="secondary-button" onClick={() => setEditing(null)}>Cerrar</button>}>
        <AllergenEditor product={editing} allergens={allergens} refresh={refreshEditing} show={show} fail={fail} /></Modal>}
    </>
  );
}
