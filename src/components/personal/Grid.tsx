import { useState } from "react";
import { appApi, addDays, dayKey, parseDay, shortDate, WEEKDAYS } from "../../config";
import { Field, Modal } from "../ui";
import { SHIFT_LABEL } from "./types";
import type { Shift, Staff, Week } from "./types";

/** Grilla semanal de turnos: una fila por persona, un casillero por día */
export default function Grid({ week, staff, monday, onWeek, reload, onFail, onOk }: {
  week: Week | null; staff: Staff[]; monday: string; onWeek: (d: string) => void; reload: () => void; onFail: (e: unknown) => void; onOk: (t: string) => void;
}) {
  const [edit, setEdit] = useState<{ id?: number; staff_id: number; day: string; start_time: string; end_time: string; area: string; status: string } | null>(null);
  const [leave, setLeave] = useState<{ staff_id: number; from_day: string; to_day: string; reason: string } | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(parseDay(monday), i)));
  const active = staff.filter((s) => s.active);

  async function save() {
    if (!edit) return;
    const body = { staff_id: edit.staff_id, day: edit.day, start_time: edit.start_time, end_time: edit.end_time, area: edit.area.trim() || null, status: edit.status };
    try {
      if (edit.id) await appApi(`/staff-shifts/${edit.id}`, { method: "PUT", body });
      else await appApi("/staff-shifts", { method: "POST", body });
      setEdit(null); reload(); onOk("Turno guardado");
    } catch (e) { onFail(e); }
  }
  async function remove() {
    if (!edit?.id) return;
    try { await appApi(`/staff-shifts/${edit.id}`, { method: "DELETE" }); setEdit(null); reload(); onOk("Turno eliminado"); } catch (e) { onFail(e); }
  }
  async function copyPrev() {
    try {
      const r = await appApi<{ detail: string }>("/staff-shifts/copy-week", { method: "POST", body: { from_day: dayKey(addDays(parseDay(monday), -7)), to_day: monday } });
      reload(); onOk(r.detail);
    } catch (e) { onFail(e); }
  }
  async function saveLeave() {
    if (!leave) return;
    try { await appApi("/time-off", { method: "POST", body: { ...leave, reason: leave.reason.trim() || null } }); setLeave(null); reload(); onOk("Licencia cargada"); } catch (e) { onFail(e); }
  }
  async function dropLeave(id: number) {
    try { await appApi(`/time-off/${id}`, { method: "DELETE" }); reload(); onOk("Licencia eliminada"); } catch (e) { onFail(e); }
  }
  const hoursOf = (id: number) => (week?.shifts || []).filter((s) => s.staff_id === id).reduce((a, s) => a + s.hours, 0);

  return (
    <div className="r3-page">
      <div className="r3-sub">
        <div className="r3-datenav">
          <button className="r2-mini" onClick={() => onWeek(dayKey(addDays(parseDay(monday), -7)))} aria-label="Semana anterior">‹</button>
          <strong>Semana del {shortDate(monday)}</strong>
          <button className="r2-mini" onClick={() => onWeek(dayKey(addDays(parseDay(monday), 7)))} aria-label="Semana siguiente">›</button>
        </div>
        <div className="r2-btn-row">
          <button className="secondary-button" onClick={copyPrev}>Copiar la semana anterior</button>
          <button className="secondary-button" onClick={() => setLeave({ staff_id: active[0]?.id || 0, from_day: monday, to_day: monday, reason: "" })} disabled={!active.length}>Cargar licencia</button>
        </div>
      </div>
      {active.length === 0 ? <div className="rs-note rs-note-info">Primero cargá a tu equipo en la pestaña Equipo.</div> : (
        <div className="r3-scroll"><div className="r3-week">
          <div className="h">Persona</div>
          {days.map((d, i) => <div key={d} className="h">{WEEKDAYS[i].slice(0, 3)}<small>{shortDate(d)}</small></div>)}
          {active.flatMap((s) => [
            <div key={`w${s.id}`} className="who">{s.name}<small>{s.job || "Sin puesto"} · {hoursOf(s.id).toFixed(1).replace(".", ",")} h</small></div>,
            ...days.map((d) => {
              const shifts = (week?.shifts || []).filter((x) => x.staff_id === s.id && x.date === d);
              const off = (week?.time_off || []).find((t) => t.staff_id === s.id && t.from_date <= d && t.to_date >= d);
              return (
                <div key={`${s.id}-${d}`}>
                  {off && <button type="button" className="r3-shift st-FRANCO" onClick={() => window.confirm("¿Quitar esta licencia?") && dropLeave(off.id)}>Licencia{off.reason ? `: ${off.reason}` : ""}</button>}
                  {shifts.map((x) => (
                    <button key={x.id} type="button" className={`r3-shift st-${x.status}`} title={SHIFT_LABEL[x.status]}
                      onClick={() => setEdit({ id: x.id, staff_id: s.id, day: d, start_time: x.start_time, end_time: x.end_time, area: x.area || "", status: x.status })}>
                      {x.start_time}–{x.end_time}{x.area ? ` · ${x.area}` : ""}
                    </button>))}
                  {!off && <button type="button" className="r3-addcell" onClick={() => setEdit({ staff_id: s.id, day: d, start_time: "19:00", end_time: "23:30", area: "", status: "PLANIFICADO" })} aria-label={`Agregar turno a ${s.name}`}>+</button>}
                </div>
              );
            }),
          ])}
        </div></div>
      )}
      {edit && (
        <Modal title={edit.id ? "Editar turno" : "Turno nuevo"} eyebrow={active.find((s) => s.id === edit.staff_id)?.name} onClose={() => setEdit(null)}
          footer={<>{edit.id && <button className="rs-danger-button" onClick={remove}>Eliminar</button>}<button className="secondary-button" onClick={() => setEdit(null)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Entra"><input type="time" value={edit.start_time} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} /></Field>
            <Field label="Sale"><input type="time" value={edit.end_time} onChange={(e) => setEdit({ ...edit, end_time: e.target.value })} /></Field>
            <Field label="Sector (opcional)"><input value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} placeholder="Salón, cocina, barra" /></Field>
            <Field label="Estado"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{Object.entries(SHIFT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
        </Modal>
      )}
      {leave && (
        <Modal title="Cargar licencia" eyebrow="Vacaciones, enfermedad, franco largo" onClose={() => setLeave(null)}
          footer={<><button className="secondary-button" onClick={() => setLeave(null)}>Cancelar</button><button className="primary-button" onClick={saveLeave}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Persona"><select value={leave.staff_id} onChange={(e) => setLeave({ ...leave, staff_id: Number(e.target.value) })}>{active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Desde"><input type="date" value={leave.from_day} onChange={(e) => setLeave({ ...leave, from_day: e.target.value })} /></Field>
            <Field label="Hasta"><input type="date" value={leave.to_day} onChange={(e) => setLeave({ ...leave, to_day: e.target.value })} /></Field>
            <Field label="Motivo"><input value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
export type { Shift };
