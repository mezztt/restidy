import { useEffect, useState } from "react";
import { appApi, shortDate } from "../../config";
import { Empty, Field, Modal, Pill, Switch } from "../ui";
import { CARNET_LABEL, CARNET_TONE } from "./types";
import type { Staff } from "./types";

interface UserLite { id: number; name: string; role: string }
const BLANK: Partial<Staff> = { tip_weight: 1, active: true };

/** Ficha del equipo con el carnet de manipulador de alimentos */
export default function Team({ staff, reload, onFail, onOk }: { staff: Staff[]; reload: () => void; onFail: (e: unknown) => void; onOk: (t: string) => void }) {
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => { if (edit && !users.length) appApi<UserLite[]>("/users").then(setUsers).catch(() => undefined); }, [edit]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!edit) return;
    const body = {
      name: (edit.name || "").trim(), dni_text: (edit.dni_text || "").trim() || null, phone: (edit.phone || "").trim() || null, job: (edit.job || "").trim() || null,
      user_id: edit.user_id || null, tip_weight: Number(edit.tip_weight ?? 1), food_handler_number: (edit.food_handler_number || "").trim() || null,
      food_handler_expires_on: edit.food_handler_expires_on || null, active: edit.active !== false,
    };
    try { await appApi(edit.id ? `/staff/${edit.id}` : "/staff", { method: edit.id ? "PUT" : "POST", body }); setEdit(null); reload(); onOk("Ficha guardada"); } catch (e) { onFail(e); }
  }
  async function remove(s: Staff) {
    if (!window.confirm(`¿Eliminar a ${s.name}?`)) return;
    try { const r = await appApi<{ detail: string }>(`/staff/${s.id}`, { method: "DELETE" }); reload(); onOk(r.detail); } catch (e) { onFail(e); }
  }
  const list = staff.filter((s) => all || s.active);
  return (
    <div className="r3-page">
      <div className="r3-sub">
        <label className="r3-chk"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Mostrar también las bajas</label>
        <button className="primary-button" onClick={() => setEdit({ ...BLANK })}>Sumar persona</button>
      </div>
      <p className="r2-muted">El carnet de manipulador de alimentos dura 3 años (Mendoza). Te avisamos 30 días antes de que venza. Restidy no liquida sueldos.</p>
      {list.length === 0 ? <Empty title="Todavía no cargaste a tu equipo">Sumá a las personas que trabajan en el local para armar turnos y ver la asistencia.</Empty> : (
        <div className="r3-grid">{list.map((s) => (
          <div key={s.id} className="r3-courier-card">
            <strong>{s.name}</strong>
            <span className="r2-muted">{s.job || "Sin puesto"}{s.phone ? ` · ${s.phone}` : ""}</span>
            <div className="r3-chips">
              {!s.active && <Pill tone="gray">De baja</Pill>}
              <Pill tone={CARNET_TONE[s.carnet_state] || "gray"}>Carnet: {CARNET_LABEL[s.carnet_state]}{s.food_handler_expires_on ? ` · vence ${shortDate(s.food_handler_expires_on)}` : ""}</Pill>
              {s.user_id && <Pill tone="blue">Tiene usuario</Pill>}
            </div>
            <div className="r2-btn-row"><button className="r2-mini" onClick={() => setEdit(s)}>Editar</button><button className="r2-mini is-danger" onClick={() => remove(s)}>Eliminar</button></div>
          </div>))}</div>
      )}
      {edit && (
        <Modal title={edit.id ? "Editar ficha" : "Sumar persona"} eyebrow="Personal" onClose={() => setEdit(null)} size="wide"
          footer={<><button className="secondary-button" onClick={() => setEdit(null)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Nombre y apellido"><input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Puesto"><input value={edit.job || ""} onChange={(e) => setEdit({ ...edit, job: e.target.value })} placeholder="Mozo, cocinero..." /></Field>
            <Field label="Teléfono"><input inputMode="tel" value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="DNI" hint="Solo si lo necesitás para tu registro."><input value={edit.dni_text || ""} onChange={(e) => setEdit({ ...edit, dni_text: e.target.value })} /></Field>
            <Field label="N° de carnet de manipulador"><input value={edit.food_handler_number || ""} onChange={(e) => setEdit({ ...edit, food_handler_number: e.target.value })} /></Field>
            <Field label="Vence el"><input type="date" value={edit.food_handler_expires_on || ""} onChange={(e) => setEdit({ ...edit, food_handler_expires_on: e.target.value })} /></Field>
            <Field label="Puntos para propinas" hint="Solo se usa en el reparto «por puntos»."><input type="number" min={0} step={0.5} value={edit.tip_weight ?? 1} onChange={(e) => setEdit({ ...edit, tip_weight: Number(e.target.value) })} /></Field>
            <Field label="Usuario del sistema" hint="Para que fiche con su PIN y vea su horario.">
              <select value={edit.user_id ?? ""} onChange={(e) => setEdit({ ...edit, user_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Sin usuario</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          </div>
          <Switch on={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="En actividad" />
        </Modal>
      )}
    </div>
  );
}
