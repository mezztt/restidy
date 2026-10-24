import { useState } from "react";
import { appApi, dateTime, money } from "../../config";
import { Field, Modal, Pill } from "../ui";
import { STATUS_TONE, SOURCE_LABEL } from "./types";
import type { DayData, Res } from "./types";

/** Una reserva: datos y acciones (confirmar seña, sentar, no vino, cancelar, devolver seña) */
export default function ResDetail({ res, data, canManage, onClose, onChanged, onFail, onOk }: {
  res: Res; data: DayData | null; canManage: boolean; onClose: () => void; onChanged: (r: Res) => void; onFail: (e: unknown) => void; onOk: (t: string) => void;
}) {
  const [tables, setTables] = useState<number[]>(res.table_ids);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: string, extra: Record<string, unknown> = {}, msg = "Listo") {
    setBusy(true);
    try { const r = await appApi<Res>(`/reservations/${res.id}`, { method: "PATCH", body: { action, ...extra } }); onChanged(r); onOk(msg); setCancelling(false); }
    catch (e) { onFail(e); } finally { setBusy(false); }
  }
  const alive = res.status === "CONFIRMADA" || res.status === "PENDIENTE_SENIA";
  const toggle = (id: number) => setTables((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <Modal title={`${res.customer_name} · ${res.party_size} personas`} eyebrow={`${res.date.split("-").reverse().join("/")} · ${res.time}`} onClose={onClose} size="wide"
      footer={<>
        {canManage && alive && <button className="rs-danger-button" onClick={() => setCancelling(true)}>Cancelar reserva</button>}
        {canManage && res.status === "CONFIRMADA" && <button className="secondary-button" disabled={busy} onClick={() => act("no_show", {}, "Marcada como «no vino»")}>No vino</button>}
        {canManage && res.status === "PENDIENTE_SENIA" && <button className="secondary-button" disabled={busy} onClick={() => act("confirm", {}, "Reserva confirmada")}>Recibí la seña</button>}
        {alive && <button className="primary-button" disabled={busy} onClick={() => act("seat", { table_ids: tables }, "Mesa abierta")}>Sentar</button>}
        {res.status === "SENTADA" && canManage && <button className="primary-button" disabled={busy} onClick={() => act("complete", {}, "Reserva completada")}>Completar</button>}
      </>}>
      <div className="r3-detail">
        <div className="r3-chips">
          <Pill tone={STATUS_TONE[res.status] || "gray"}>{res.status_label}</Pill>
          <Pill tone="gray">{SOURCE_LABEL[res.source] || res.source}</Pill>
          {res.no_show_flag && <Pill tone="red">{res.customer_no_shows} veces no vino</Pill>}
          {res.deposit_amount > 0 && <Pill tone={res.deposit_status === "APROBADA" ? "green" : res.deposit_status === "DEVUELTA" ? "gray" : "orange"}>Seña {money(res.deposit_amount)} · {res.deposit_status === "APROBADA" ? "pagada" : res.deposit_status === "DEVUELTA" ? "devuelta" : "pendiente"}</Pill>}
        </div>
        <div className="r3-kv">
          {res.phone && <span><a className="rs-link" href={`tel:${res.phone}`}>{res.phone}</a></span>}
          {res.email && <span>{res.email}</span>}
          <small>Dura {res.duration_min} min · {res.table_names.join(" + ") || "sin mesa asignada"}</small>
          {res.notes && <small className="r3-note-line">{res.notes}</small>}
          {res.cancel_reason && <small>Motivo: {res.cancel_reason}</small>}
          {res.status === "PENDIENTE_SENIA" && res.deposit_expires_at && <small>La seña vence {dateTime(res.deposit_expires_at)}</small>}
        </div>
        {alive && data && (
          <div>
            <h3>Mesas</h3>
            <div className="r3-slots">{data.tables.map((t) => (
              <button key={t.id} type="button" className={`r3-slot ${tables.includes(t.id) ? "is-on" : ""}`} onClick={() => toggle(t.id)}>{t.name} ({t.seats})</button>
            ))}</div>
            <p className="r2-muted">Al sentar, se abre la cuenta en la primera mesa elegida.</p>
          </div>
        )}
        {canManage && res.deposit_status === "APROBADA" && (res.status === "CANCELADA" || res.status === "NO_SHOW") && (
          <div className="rs-note rs-note-info">Tiene una seña cobrada. Según tu política, devolvela desde tu cuenta de Mercado Pago y registralo acá.
            <div className="r2-btn-row"><button className="secondary-button" disabled={busy} onClick={() => act("refund_deposit", {}, "Seña marcada como devuelta")}>Marcar seña devuelta</button></div></div>
        )}
        {cancelling && (
          <div className="rs-note rs-note-warn r3-detail">
            <Field label="Motivo (opcional)"><input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="El cliente avisó que no viene..." /></Field>
            <div className="r2-btn-row"><button className="secondary-button" onClick={() => setCancelling(false)}>Volver</button><button className="rs-danger-button" disabled={busy} onClick={() => act("cancel", { reason }, "Reserva cancelada")}>Confirmar cancelación</button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
