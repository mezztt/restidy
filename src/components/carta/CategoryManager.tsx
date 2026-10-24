import { useState } from "react";
import { appApi } from "../../config";
import { Modal } from "../ui";
import { ConfirmModal } from "../r1/common";
import type { Category, Notify, Station } from "./types";

export default function CategoryManager({ cats, stations, onClose, reload, show, fail }: Notify & {
  cats: Category[]; stations: Station[]; onClose: () => void; reload: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [station, setStation] = useState("");
  const [del, setDel] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) show(ok); await reload(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const add = () => run(async () => { await appApi("/categories", { method: "POST", body: { name, default_station_id: station ? Number(station) : null } }); setName(""); }, "Categoría creada");
  const move = (i: number, d: number) => {
    const ids = cats.map((c) => c.id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return run(() => appApi("/categories/reorder", { method: "POST", body: { ids } }));
  };
  return (
    <Modal eyebrow="CARTA" title="Categorías" size="wide" onClose={onClose} footer={<button className="primary-button" onClick={onClose}>Listo</button>}>
      <p className="rs-muted">El orden de acá es el de la carta. La estación es el lugar donde se prepara por defecto (cocina o barra).</p>
      <ul className="rs-list">
        {cats.map((c, i) => (
          <li key={c.id}>
            <div className="rs-list-main"><strong>{c.name}{!c.active && " (oculta)"}</strong><small>{c.product_count} productos</small></div>
            <select className="r1-inp" style={{ width: 150 }} aria-label={`Estación de ${c.name}`} value={c.default_station_id ?? ""} disabled={busy}
              onChange={(e) => run(() => appApi(`/categories/${c.id}`, { method: "PUT", body: { default_station_id: e.target.value ? Number(e.target.value) : null } }))}>
              <option value="">Sin estación</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="secondary-button" aria-label={`Subir ${c.name}`} disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="secondary-button" aria-label={`Bajar ${c.name}`} disabled={busy || i === cats.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="secondary-button" disabled={busy} onClick={() => run(() => appApi(`/categories/${c.id}`, { method: "PUT", body: { active: !c.active } }), c.active ? "Categoría oculta" : "Categoría visible")}>{c.active ? "Ocultar" : "Mostrar"}</button>
            <button className="rs-link rs-link-danger" onClick={() => setDel(c)}>Borrar</button>
          </li>
        ))}
      </ul>
      {!cats.length && <div className="rs-empty">Todavía no hay categorías.</div>}
      <div className="r1-row-edit" style={{ marginTop: 14, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) auto" }}>
        <input placeholder="Nueva categoría (Ej: Entradas)" aria-label="Nombre de la categoría" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) add(); }} />
        <select aria-label="Estación" value={station} onChange={(e) => setStation(e.target.value)}><option value="">Sin estación</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="primary-button" disabled={busy || !name.trim()} onClick={add}>Agregar</button>
      </div>
      {del && <ConfirmModal title={`Borrar «${del.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setDel(null)}
        onConfirm={() => run(async () => { await appApi(`/categories/${del.id}`, { method: "DELETE" }); setDel(null); }, "Categoría borrada")}>
        {del.product_count ? "Tiene productos: el sistema no la borra si todavía los tiene (movelos o ocultá la categoría)." : "Se borra del todo."}
      </ConfirmModal>}
    </Modal>
  );
}
