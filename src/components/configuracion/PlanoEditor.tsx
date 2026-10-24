import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as KEvent, PointerEvent as PEvent } from "react";
import { appApi } from "../../config";
import { Field, Loading, Modal } from "../ui";
import { ConfirmModal, EmptyAction } from "../r1/common";
import QrCode, { fullUrl } from "../r1/QrCode";

interface Area { id: number; name: string; sort: number; active: boolean; table_count: number }
export interface Tbl { id: number; area_id: number; name: string; seats: number; shape: "CUADRADA" | "REDONDA" | "BARRA"; x: number; y: number; w: number; h: number; active: boolean }
interface Notify { show: (t: string, error?: boolean) => void; fail: (e: unknown) => void }
interface QrInfo { id: number; name: string; url: string; enabled: boolean }
const SHAPES: [Tbl["shape"], string][] = [["CUADRADA", "Cuadrada"], ["REDONDA", "Redonda"], ["BARRA", "Barra"]];
const SNAP = 10, W = 900, H = 560;

export default function PlanoEditor({ show, fail }: Notify) {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [tables, setTables] = useState<Tbl[]>([]);
  const [area, setArea] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<"area" | "bulk" | "rename" | "delArea" | "delTable" | "qr" | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([appApi<Area[]>("/areas"), appApi<Tbl[]>("/tables")]);
      setAreas(a); setTables(t); setDirty(new Set());
      setArea((cur) => (a.some((x) => x.id === cur) ? cur : a[0]?.id ?? 0));
    } catch (e) { fail(e); setAreas((x) => x ?? []); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  if (!areas) return <Loading />;
  const inArea = tables.filter((t) => t.area_id === area);
  const selected = tables.find((t) => t.id === sel) || null;
  const cur = areas.find((a) => a.id === area) || null;

  const patchLocal = (id: number, p: Partial<Tbl>) => setTables((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  function onDown(e: PEvent, t: Tbl) {
    const rect = canvas.current!.getBoundingClientRect();
    drag.current = { id: t.id, dx: e.clientX - rect.left - t.x, dy: e.clientY - rect.top - t.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(t.id);
  }
  function onMove(e: PEvent, t: Tbl) {
    const d = drag.current;
    if (!d || d.id !== t.id) return;
    const rect = canvas.current!.getBoundingClientRect();
    const snap = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v / SNAP) * SNAP));
    patchLocal(t.id, { x: snap(e.clientX - rect.left - d.dx, W - t.w), y: snap(e.clientY - rect.top - d.dy, H - t.h) });
    setDirty((s) => new Set(s).add(t.id));
  }
  function nudge(e: KEvent, t: Tbl) {
    const step = e.shiftKey ? 50 : SNAP;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = m[e.key];
    if (!v) return;
    e.preventDefault();
    patchLocal(t.id, { x: Math.max(0, Math.min(W - t.w, t.x + v[0])), y: Math.max(0, Math.min(H - t.h, t.y + v[1])) });
    setDirty((s) => new Set(s).add(t.id));
  }
  async function saveLayout() {
    try {
      await appApi("/tables/layout", { method: "PUT", body: { tables: tables.filter((t) => dirty.has(t.id)).map((t) => ({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h })) } });
      show("Plano guardado"); setDirty(new Set());
    } catch (e) { fail(e); }
  }
  async function addTable() {
    try {
      const n = inArea.length + 1;
      const t = await appApi<Tbl>("/tables", { method: "POST", body: { area_id: area, name: `Mesa ${n}`, seats: 4, shape: "CUADRADA" } });
      setTables((ts) => [...ts, t]); setSel(t.id); show("Mesa agregada");
      await appApi<Area[]>("/areas").then(setAreas);
    } catch (e) { fail(e); }
  }
  async function saveTable() {
    if (!selected) return;
    try {
      await appApi(`/tables/${selected.id}`, { method: "PUT", body: { name: selected.name, seats: selected.seats, shape: selected.shape, w: selected.w, h: selected.h, active: selected.active } });
      show("Mesa guardada");
    } catch (e) { fail(e); }
  }
  async function delTable() {
    if (!selected) return;
    try { const r = await appApi<{ detail: string }>(`/tables/${selected.id}`, { method: "DELETE" }); show(r.detail); setSel(null); setModal(null); await load(); } catch (e) { fail(e); setModal(null); }
  }

  return (
    <div className="rs-stack">
      <div className="rs-card">
        <div className="rs-card-head"><div><h2>Plano de mesas</h2><p>Armá los sectores y arrastrá las mesas para dejarlas como en tu salón. El salón usa este mismo plano.</p></div>
          <div className="rs-row"><a className="secondary-button" href="/print/qr-mesas" target="_blank" rel="noreferrer" style={{ textDecoration: "none", padding: "10px 16px", borderRadius: 12 }}>Imprimir QR de las mesas</a></div></div>
        {!areas.length ? (
          <EmptyAction title="Todavía no tenés sectores" text="Un sector es una zona del local (Salón, Terraza, Barra). Creá el primero y después agregá mesas." action="Crear sector" onAction={() => setModal("area")} />
        ) : (
          <>
            <div className="rs-row" style={{ marginBottom: 12 }}>
              <div className="r1-chips">{areas.map((a) => <button key={a.id} type="button" aria-pressed={a.id === area} className={`r1-chip ${a.id === area ? "is-on" : ""}`} onClick={() => { setArea(a.id); setSel(null); }}>{a.name} · {a.table_count}</button>)}</div>
              <button className="secondary-button" onClick={() => setModal("area")}>Nuevo sector</button>
              <button className="secondary-button" onClick={() => setModal("rename")}>Renombrar</button>
              <button className="rs-link rs-link-danger" onClick={() => setModal("delArea")}>Borrar sector</button>
            </div>
            <div className="r1-split" style={{ gridTemplateColumns: "minmax(0,1fr) 270px" }}>
              <div>
                <div className="r1-plan-wrap">
                  <div className="r1-plan" ref={canvas} style={{ width: W, height: H }} onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
                    {inArea.map((t) => (
                      <div key={t.id} role="button" tabIndex={0} aria-label={`${t.name}, ${t.seats} lugares. Flechas para mover`}
                        className={`r1-table ${t.shape === "REDONDA" ? "is-round" : t.shape === "BARRA" ? "is-bar" : ""} ${t.id === sel ? "is-sel" : ""} ${t.active ? "" : "is-off"}`}
                        style={{ left: t.x, top: t.y, width: t.w, height: t.h, borderRadius: t.shape === "CUADRADA" ? 10 : undefined }}
                        onPointerDown={(e) => onDown(e, t)} onPointerMove={(e) => onMove(e, t)} onPointerUp={() => { drag.current = null; }} onKeyDown={(e) => nudge(e, t)} onFocus={() => setSel(t.id)}>
                        <span>{t.name}</span><small>{t.seats} lugares</small>
                      </div>))}
                    {!inArea.length && <div className="rs-empty" style={{ position: "absolute", inset: 20, background: "transparent", border: 0 }}>Este sector no tiene mesas. Agregá una o creá varias de golpe.</div>}
                  </div>
                </div>
                <div className="rs-row" style={{ marginTop: 12, justifyContent: "space-between" }}>
                  <div className="rs-row"><button className="secondary-button" onClick={addTable}>Agregar mesa</button><button className="secondary-button" onClick={() => setModal("bulk")}>Crear varias</button></div>
                  <div className="rs-row">{dirty.size > 0 && <span className="rs-muted">Cambios sin guardar</span>}<button className="primary-button" disabled={!dirty.size} onClick={saveLayout}>Guardar plano</button></div>
                </div>
              </div>
              <div className="r1-plan-side">
                {!selected ? <div className="rs-note rs-note-info">Tocá una mesa para editar su nombre, lugares y forma, o para ver su QR.</div> : (
                  <div className="rs-card" style={{ boxShadow: "none" }}>
                    <div className="rs-stack">
                      <Field label="Nombre"><input value={selected.name} onChange={(e) => patchLocal(selected.id, { name: e.target.value })} /></Field>
                      <Field label="Lugares"><input inputMode="numeric" value={selected.seats} onChange={(e) => patchLocal(selected.id, { seats: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
                      <Field label="Forma"><select value={selected.shape} onChange={(e) => patchLocal(selected.id, { shape: e.target.value as Tbl["shape"] })}>{SHAPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                      <div className="r1-grid-form"><Field label="Ancho"><input inputMode="numeric" value={selected.w} onChange={(e) => { patchLocal(selected.id, { w: Number(e.target.value.replace(/\D/g, "")) || 30 }); setDirty((s) => new Set(s).add(selected.id)); }} /></Field>
                        <Field label="Alto"><input inputMode="numeric" value={selected.h} onChange={(e) => { patchLocal(selected.id, { h: Number(e.target.value.replace(/\D/g, "")) || 30 }); setDirty((s) => new Set(s).add(selected.id)); }} /></Field></div>
                      <div className="rs-inline-checks"><label><input type="checkbox" checked={selected.active} onChange={(e) => patchLocal(selected.id, { active: e.target.checked })} /> Mesa en uso</label></div>
                      <button className="primary-button" onClick={saveTable}>Guardar mesa</button>
                      <button className="secondary-button" onClick={() => setModal("qr")}>Ver QR de la mesa</button>
                      <button className="rs-danger-button" onClick={() => setModal("delTable")}>Borrar mesa</button>
                    </div>
                  </div>)}
              </div>
            </div>
          </>)}
      </div>
      {modal === "area" && <AreaModal onClose={() => setModal(null)} onDone={async (id) => { await load(); setArea(id); }} show={show} fail={fail} />}
      {modal === "rename" && cur && <AreaModal area={cur} onClose={() => setModal(null)} onDone={async () => { await load(); }} show={show} fail={fail} />}
      {modal === "bulk" && cur && <BulkModal area={cur} onClose={() => setModal(null)} onDone={load} show={show} fail={fail} />}
      {modal === "qr" && selected && <QrModal table={selected} onClose={() => setModal(null)} show={show} fail={fail} />}
      {modal === "delArea" && cur && <ConfirmModal title={`Borrar «${cur.name}»`} confirmLabel="Borrar" danger onClose={() => setModal(null)}
        onConfirm={async () => { try { const r = await appApi<{ detail: string }>(`/areas/${cur.id}`, { method: "DELETE" }); show(r.detail); setModal(null); await load(); } catch (e) { fail(e); setModal(null); } }}>
        {cur.table_count ? "Tiene mesas: movelas o borralas primero. Si ya tuvieron pedidos, el sistema lo deja desactivado." : "Se borra el sector."}</ConfirmModal>}
      {modal === "delTable" && selected && <ConfirmModal title={`Borrar «${selected.name}»`} confirmLabel="Borrar" danger onClose={() => setModal(null)} onConfirm={delTable}>Si la mesa ya tuvo pedidos queda desactivada para no perder el historial. El QR impreso deja de servir.</ConfirmModal>}
    </div>
  );
}

function AreaModal({ area, onClose, onDone, show, fail }: Notify & { area?: Area; onClose: () => void; onDone: (id: number) => Promise<void> }) {
  const [name, setName] = useState(area?.name ?? "");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { const a = await appApi<Area>(area ? `/areas/${area.id}` : "/areas", { method: area ? "PUT" : "POST", body: { name } }); show("Sector guardado"); await onDone(a.id); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="SECTOR" title={area ? "Renombrar sector" : "Nuevo sector"} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" disabled={busy || !name.trim()} onClick={go}>Guardar</button></>}>
      <Field label="Nombre"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Salón, Terraza, Barra..." onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) go(); }} /></Field>
    </Modal>
  );
}

function BulkModal({ area, onClose, onDone, show, fail }: Notify & { area: Area; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ count: "10", prefix: "Mesa", start: String(area.table_count + 1), seats: "4", shape: "CUADRADA" });
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>("/tables/bulk", { method: "POST", body: { area_id: area.id, count: Number(f.count), prefix: f.prefix, start: Number(f.start), seats: Number(f.seats), shape: f.shape } }); show(r.detail); await onDone(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow={area.name.toUpperCase()} title="Crear varias mesas" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" disabled={busy} onClick={go}>Crear mesas</button></>}>
      <div className="r1-grid-form">
        <Field label="Cantidad"><input inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></Field>
        <Field label="Lugares por mesa"><input inputMode="numeric" value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} /></Field>
        <Field label="Nombre"><input value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })} /></Field>
        <Field label="Empezar en el número"><input inputMode="numeric" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="Forma"><select value={f.shape} onChange={(e) => setF({ ...f, shape: e.target.value })}>{SHAPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <p className="rs-muted" style={{ marginTop: 10 }}>Se acomodan solas en grilla; después las arrastrás. Las que ya existen con ese nombre se saltean.</p>
    </Modal>
  );
}

function QrModal({ table, onClose, show, fail }: Notify & { table: Tbl; onClose: () => void }) {
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => { appApi<QrInfo>(`/tables/${table.id}/qr`).then(setQr).catch(fail); }, [table.id, fail]);
  async function regen() {
    try { setQr(await appApi<QrInfo>(`/tables/${table.id}/regenerate-token`, { method: "POST" })); show("QR nuevo generado: reemplazá el impreso"); } catch (e) { fail(e); }
    setAsk(false);
  }
  const url = qr ? fullUrl(qr.url) : "";
  return (
    <Modal eyebrow="QR DE LA MESA" title={table.name} onClose={onClose} footer={<button className="secondary-button" onClick={onClose}>Cerrar</button>}>
      {!qr ? <Loading /> : (
        <div className="rs-stack">
          {!qr.enabled && <div className="rs-note rs-note-warn">Tu plan no incluye la carta web / pedidos por QR: el link no va a abrir nada hasta que lo contrates.</div>}
          <div className="r1-qr-box"><QrCode text={url} label={`QR de ${table.name}`} /></div>
          <div className="r1-link-box">{url}</div>
          <div className="rs-row"><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(url).then(() => show("Link copiado"), () => show("No se pudo copiar", true))}>Copiar link</button>
            <button className="rs-danger-button" onClick={() => setAsk(true)}>Regenerar QR</button></div>
          <p className="rs-muted">Si alguien sacó una foto del QR o lo querés cambiar, regeneralo: el impreso anterior deja de funcionar.</p>
        </div>)}
      {ask && <ConfirmModal title="Regenerar el QR" confirmLabel="Regenerar" danger onClose={() => setAsk(false)} onConfirm={regen}>El QR que tenés impreso en esta mesa deja de funcionar y vas a tener que imprimir el nuevo.</ConfirmModal>}
    </Modal>
  );
}
