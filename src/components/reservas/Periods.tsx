import { useState } from "react";
import { appApi, WEEKDAYS } from "../../config";
import { Empty, Field, Modal, Pill, Switch } from "../ui";
import type { Period } from "./types";

const EMPTY: Period = { id: 0, name: "", days: [0, 1, 2, 3, 4, 5, 6], open_time: "20:00", close_time: "23:30", slot_minutes: 30, max_covers_per_slot: 40, max_party_size: 10, min_notice_min: 60, max_days_ahead: 30, active: true };
const SHORT = ["L", "M", "X", "J", "V", "S", "D"];

export default function Periods({ periods, blocked, reload, onFail, onOk }: {
  periods: Period[]; blocked: { id: number; date: string; period_id: number | null; reason: string | null }[]; reload: () => void; onFail: (e: unknown) => void; onOk: (t: string) => void;
}) {
  const [edit, setEdit] = useState<Period | null>(null);
  const [blk, setBlk] = useState({ day: "", reason: "" });

  async function save() {
    if (!edit) return;
    const { id, ...body } = edit;
    try {
      await appApi(id ? `/service-periods/${id}` : "/service-periods", { method: id ? "PUT" : "POST", body });
      setEdit(null); reload(); onOk("Turno guardado");
    } catch (e) { onFail(e); }
  }
  async function remove(p: Period) {
    if (!window.confirm(`¿Eliminar el turno ${p.name}?`)) return;
    try { await appApi(`/service-periods/${p.id}`, { method: "DELETE" }); reload(); onOk("Turno eliminado"); } catch (e) { onFail(e); }
  }
  async function block() {
    if (!blk.day) return;
    try { await appApi("/blocked-dates", { method: "POST", body: { day: blk.day, reason: blk.reason.trim() || null } }); setBlk({ day: "", reason: "" }); reload(); onOk("Día bloqueado"); } catch (e) { onFail(e); }
  }
  async function unblock(id: number) {
    try { await appApi(`/blocked-dates/${id}`, { method: "DELETE" }); reload(); onOk("Se vuelve a reservar ese día"); } catch (e) { onFail(e); }
  }
  const set = <K extends keyof Period>(k: K, v: Period[K]) => setEdit((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div className="r3-page">
      <div className="r3-sub"><p className="r2-muted">Un turno define los días y horarios en que se aceptan reservas, cada cuánto hay lugar y cuántos cubiertos entran a la vez.</p>
        <button className="primary-button" onClick={() => setEdit({ ...EMPTY })}>Nuevo turno</button></div>
      {periods.length === 0 ? <Empty title="Todavía no hay turnos">Sin turnos no se pueden tomar reservas ni desde la web. Creá, por ejemplo, «Cena» de 20:00 a 23:30.</Empty> : (
        <div className="r3-grid">{periods.map((p) => (
          <div key={p.id} className="r3-courier-card">
            <strong>{p.name}</strong>
            <span className="r2-muted">{p.open_time} a {p.close_time} · cada {p.slot_minutes} min</span>
            <span className="r2-muted">{p.days.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ")}</span>
            <span className="r2-muted">Hasta {p.max_covers_per_slot} cubiertos a la vez · grupos de hasta {p.max_party_size}</span>
            <div className="r3-chips">{p.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Pausado</Pill>}</div>
            <div className="r2-btn-row"><button className="r2-mini" onClick={() => setEdit(p)}>Editar</button><button className="r2-mini is-danger" onClick={() => remove(p)}>Eliminar</button></div>
          </div>))}</div>
      )}
      <h3>Días sin reservas</h3>
      <div className="r3-form"><Field label="Día"><input type="date" value={blk.day} onChange={(e) => setBlk({ ...blk, day: e.target.value })} /></Field>
        <Field label="Motivo"><input value={blk.reason} maxLength={150} onChange={(e) => setBlk({ ...blk, reason: e.target.value })} placeholder="Evento privado, feriado..." /></Field>
        <div className="form-group" style={{ alignSelf: "end" }}><button className="secondary-button" onClick={block} disabled={!blk.day}>Bloquear día</button></div></div>
      {blocked.length > 0 && <div className="r3-chips">{blocked.map((b) => (
        <span key={b.id} className="rs-chip">{b.date.split("-").reverse().join("/")}{b.reason ? ` · ${b.reason}` : ""} <button type="button" className="r2-mini" onClick={() => unblock(b.id)} aria-label="Quitar bloqueo">×</button></span>))}</div>}

      {edit && (
        <Modal title={edit.id ? "Editar turno" : "Nuevo turno"} eyebrow="Reservas" onClose={() => setEdit(null)} size="wide"
          footer={<><button className="secondary-button" onClick={() => setEdit(null)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Nombre" wide><input value={edit.name} onChange={(e) => set("name", e.target.value)} placeholder="Almuerzo, Cena..." /></Field>
            <Field label="Abre"><input type="time" value={edit.open_time} onChange={(e) => set("open_time", e.target.value)} /></Field>
            <Field label="Última hora de reserva"><input type="time" value={edit.close_time} onChange={(e) => set("close_time", e.target.value)} /></Field>
            <Field label="Cada cuántos minutos"><input type="number" min={10} max={180} value={edit.slot_minutes} onChange={(e) => set("slot_minutes", Number(e.target.value))} /></Field>
            <Field label="Cubiertos a la vez"><input type="number" min={1} value={edit.max_covers_per_slot} onChange={(e) => set("max_covers_per_slot", Number(e.target.value))} /></Field>
            <Field label="Personas por reserva (máx.)"><input type="number" min={1} max={100} value={edit.max_party_size} onChange={(e) => set("max_party_size", Number(e.target.value))} /></Field>
            <Field label="Anticipación mínima (min)"><input type="number" min={0} value={edit.min_notice_min} onChange={(e) => set("min_notice_min", Number(e.target.value))} /></Field>
            <Field label="Se reserva hasta (días antes)"><input type="number" min={1} max={365} value={edit.max_days_ahead} onChange={(e) => set("max_days_ahead", Number(e.target.value))} /></Field>
          </div>
          <Field label="Días">
            <div className="r3-daychip">{SHORT.map((l, i) => (
              <label key={i}><input type="checkbox" checked={edit.days.includes(i)} onChange={() => set("days", edit.days.includes(i) ? edit.days.filter((x) => x !== i) : [...edit.days, i].sort())} /><span title={WEEKDAYS[i]}>{l}</span></label>))}</div>
          </Field>
          <Switch on={edit.active} onChange={(v) => set("active", v)} label="Turno activo" />
        </Modal>
      )}
    </div>
  );
}
