import { useEffect, useState } from "react";
import { appApi, money } from "../../config";
import { Empty, Field, Modal, Pill, Switch } from "../ui";
import type { Courier, Zone } from "./types";

interface UserLite { id: number; name: string; role: string }

export function ZonesTab({ zones, canEdit, reload, onFail, onOk }: { zones: Zone[]; canEdit: boolean; reload: () => void; onFail: (e: unknown) => void; onOk: (t: string) => void }) {
  const [edit, setEdit] = useState<Partial<Zone> | null>(null);
  async function save() {
    if (!edit) return;
    const body = { name: (edit.name || "").trim(), fee: Number(edit.fee || 0), min_order: Number(edit.min_order || 0), est_minutes: Number(edit.est_minutes ?? 30), active: edit.active !== false };
    try {
      await appApi(edit.id ? `/delivery-zones/${edit.id}` : "/delivery-zones", { method: edit.id ? "PUT" : "POST", body });
      setEdit(null); reload(); onOk("Zona guardada");
    } catch (e) { onFail(e); }
  }
  async function remove(z: Zone) {
    if (!window.confirm(`¿Eliminar la zona ${z.name}?`)) return;
    try { const r = await appApi<{ detail: string }>(`/delivery-zones/${z.id}`, { method: "DELETE" }); onOk(r.detail); reload(); } catch (e) { onFail(e); }
  }
  return (
    <div className="r3-page">
      <div className="r3-sub"><p className="r2-muted">Cada zona define el costo de envío, el pedido mínimo y el tiempo estimado que se suma a la preparación.</p>
        {canEdit && <button className="primary-button" onClick={() => setEdit({ fee: 0, min_order: 0, est_minutes: 30, active: true })}>Nueva zona</button>}</div>
      {zones.length === 0 ? <Empty title="Todavía no hay zonas">Creá la primera para poder tomar pedidos de delivery.</Empty> : (
        <div className="r3-scroll"><table className="r3-table"><thead><tr><th>Zona</th><th className="num">Envío</th><th className="num">Mínimo</th><th className="num">Minutos</th><th>Estado</th><th /></tr></thead>
          <tbody>{zones.map((z) => (
            <tr key={z.id}><td><strong>{z.name}</strong></td><td className="num">{money(z.fee)}</td><td className="num">{z.min_order ? money(z.min_order) : "—"}</td><td className="num">{z.est_minutes}</td>
              <td>{z.active ? <Pill tone="green">Activa</Pill> : <Pill tone="gray">Inactiva</Pill>}</td>
              <td>{canEdit && <div className="r2-btn-row"><button className="r2-mini" onClick={() => setEdit(z)}>Editar</button><button className="r2-mini is-danger" onClick={() => remove(z)}>Eliminar</button></div>}</td></tr>
          ))}</tbody></table></div>
      )}
      {edit && (
        <Modal title={edit.id ? "Editar zona" : "Nueva zona"} eyebrow="Delivery" onClose={() => setEdit(null)}
          footer={<><button className="secondary-button" onClick={() => setEdit(null)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Nombre" wide><input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Centro, Zona norte..." /></Field>
            <Field label="Costo de envío ($)"><input type="number" min={0} value={edit.fee ?? 0} onChange={(e) => setEdit({ ...edit, fee: Number(e.target.value) })} /></Field>
            <Field label="Pedido mínimo ($)"><input type="number" min={0} value={edit.min_order ?? 0} onChange={(e) => setEdit({ ...edit, min_order: Number(e.target.value) })} /></Field>
            <Field label="Minutos de viaje"><input type="number" min={0} max={240} value={edit.est_minutes ?? 30} onChange={(e) => setEdit({ ...edit, est_minutes: Number(e.target.value) })} /></Field>
          </div>
          <Switch on={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Zona activa" />
        </Modal>
      )}
    </div>
  );
}

export function CouriersTab({ couriers, canEdit, reload, onFail, onOk }: { couriers: Courier[]; canEdit: boolean; reload: () => void; onFail: (e: unknown) => void; onOk: (t: string) => void }) {
  const [edit, setEdit] = useState<Partial<Courier> | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  useEffect(() => { if (edit && !users.length) appApi<UserLite[]>("/users").then((u) => setUsers(u.filter((x) => x.role === "REPARTIDOR"))).catch(() => undefined); }, [edit]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!edit) return;
    const body = { name: (edit.name || "").trim(), phone: (edit.phone || "").trim() || null, user_id: edit.user_id || null, active: edit.active !== false };
    try {
      await appApi(edit.id ? `/couriers/${edit.id}` : "/couriers", { method: edit.id ? "PUT" : "POST", body });
      setEdit(null); reload(); onOk("Repartidor guardado");
    } catch (e) { onFail(e); }
  }
  async function remove(c: Courier) {
    if (!window.confirm(`¿Eliminar a ${c.name}?`)) return;
    try { const r = await appApi<{ detail: string }>(`/couriers/${c.id}`, { method: "DELETE" }); onOk(r.detail); reload(); } catch (e) { onFail(e); }
  }
  return (
    <div className="r3-page">
      <div className="r3-sub"><p className="r2-muted">Si le vinculás un usuario con rol Repartidor, esa persona ve solo sus entregas desde el celular.</p>
        {canEdit && <button className="primary-button" onClick={() => setEdit({ active: true })}>Nuevo repartidor</button>}</div>
      {couriers.length === 0 ? <Empty title="Todavía no hay repartidores">Cargá a quienes salen a entregar.</Empty> : (
        <div className="r3-grid">{couriers.map((c) => (
          <div key={c.id} className="r3-courier-card">
            <strong>{c.name}</strong>
            <span className="r2-muted">{c.phone || "Sin teléfono"}{c.user_name ? ` · usuario ${c.user_name}` : ""}</span>
            <div className="r3-chips">{c.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}{c.active_orders > 0 && <Pill tone="violet">{c.active_orders} en curso</Pill>}</div>
            {canEdit && <div className="r2-btn-row"><button className="r2-mini" onClick={() => setEdit(c)}>Editar</button><button className="r2-mini is-danger" onClick={() => remove(c)}>Eliminar</button></div>}
          </div>))}</div>
      )}
      {edit && (
        <Modal title={edit.id ? "Editar repartidor" : "Nuevo repartidor"} eyebrow="Delivery" onClose={() => setEdit(null)}
          footer={<><button className="secondary-button" onClick={() => setEdit(null)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Nombre"><input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Teléfono"><input inputMode="tel" value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Usuario del sistema" hint="Opcional. Solo aparecen usuarios con rol Repartidor.">
              <select value={edit.user_id ?? ""} onChange={(e) => setEdit({ ...edit, user_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Sin usuario</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          </div>
          <Switch on={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Repartidor activo" />
        </Modal>
      )}
    </div>
  );
}
