import { useCallback, useEffect, useState } from "react";
import { appApi } from "../../config";
import { Loading, Pill } from "../ui";
import { ConfirmModal, EmptyAction } from "../r1/common";

interface Station { id: number; name: string; kind: "COCINA" | "BARRA"; color: string; active: boolean }
interface Notify { show: (t: string, error?: boolean) => void; fail: (e: unknown) => void }

/** Estaciones de preparación: a dónde van los pedidos (cocina, barra, parrilla…) */
export default function StationsCard({ show, fail }: Notify) {
  const [rows, setRows] = useState<Station[] | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"COCINA" | "BARRA">("COCINA");
  const [color, setColor] = useState("#b8432b");
  const [del, setDel] = useState<Station | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => appApi<Station[]>("/stations").then(setRows).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);
  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) show(ok); await load(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  if (!rows) return <Loading />;
  return (
    <div className="rs-card">
      <div className="rs-card-head"><div><h2>Estaciones</h2><p>Cada producto se prepara en una estación; la pantalla de cocina muestra solo lo suyo.</p></div></div>
      {!rows.length ? <EmptyAction title="No hay estaciones" text="Creá al menos «Cocina» y, si tenés, «Barra»." /> : (
        <ul className="rs-list">
          {rows.map((s) => (
            <li key={s.id}>
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: s.color, border: "1px solid var(--rs-line)", flex: "none" }} />
              <div className="rs-list-main"><strong>{s.name}</strong><small>{s.kind === "BARRA" ? "Barra" : "Cocina"}</small></div>
              {!s.active && <Pill tone="gray">Inactiva</Pill>}
              <button className="secondary-button" disabled={busy} onClick={() => run(() => appApi(`/stations/${s.id}`, { method: "PUT", body: { active: !s.active } }), s.active ? "Estación desactivada" : "Estación activada")}>{s.active ? "Desactivar" : "Activar"}</button>
              <button className="rs-link rs-link-danger" onClick={() => setDel(s)}>Borrar</button>
            </li>))}
        </ul>)}
      <div className="r1-row-edit" style={{ marginTop: 14, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 56px auto" }}>
        <input aria-label="Nombre de la estación" placeholder="Nueva estación (Ej: Parrilla)" value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as "COCINA" | "BARRA")}><option value="COCINA">Cocina</option><option value="BARRA">Barra</option></select>
        <input type="color" aria-label="Color" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: 2, height: 40 }} />
        <button className="primary-button" disabled={busy || !name.trim()} onClick={() => run(async () => { await appApi("/stations", { method: "POST", body: { name, kind, color } }); setName(""); }, "Estación creada")}>Agregar</button>
      </div>
      {del && <ConfirmModal title={`Borrar «${del.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setDel(null)} onConfirm={() => run(async () => { const r = await appApi<{ detail: string }>(`/stations/${del.id}`, { method: "DELETE" }); show(r.detail); setDel(null); })}>
        Si hay productos o categorías que la usan, se desactiva en vez de borrarse.</ConfirmModal>}
    </div>
  );
}
