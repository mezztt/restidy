import { useState } from "react";
import { appApi, dateTime, hhmm, money } from "../../config";
import { Field, Modal, Pill } from "../ui";
import { printHtml, remitoHtml } from "../../pages/print/printDoc";
import { STATUS_TONE, SOURCE_LABEL, nextStep, isLate } from "./types";
import type { Courier, DeliveryRow } from "./types";

/** Detalle de un pedido: datos, platos, historial y los pasos que se pueden dar */
export default function DetailModal({ row, couriers, canWrite, repartidor, onClose, onChange, onFail, onOk }: {
  row: DeliveryRow; couriers: Courier[]; canWrite: boolean; repartidor: boolean; onClose: () => void;
  onChange: (d: DeliveryRow) => void; onFail: (e: unknown) => void; onOk: (t: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const next = nextStep(row);
  const final = ["ENTREGADO", "RETIRADO", "CANCELADO"].includes(row.status);

  async function move(status: string, why?: string) {
    setBusy(true);
    try {
      const d = await appApi<DeliveryRow>(`/deliveries/${row.id}/status`, { method: "PATCH", body: { status, reason: why || null } });
      onChange({ ...row, ...d }); onOk(`Pedido #${String(row.number).padStart(3, "0")}: ${d.status_label}`);
      setCancelling(false);
    } catch (e) { onFail(e); } finally { setBusy(false); }
  }
  async function assign(id: string) {
    try {
      const d = await appApi<DeliveryRow>(`/deliveries/${row.id}/courier`, { method: "PATCH", body: { courier_id: id ? Number(id) : null } });
      onChange({ ...row, ...d }); onOk(id ? "Repartidor asignado" : "Repartidor quitado");
    } catch (e) { onFail(e); }
  }
  const mapUrl = row.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address)}` : "";

  return (
    <Modal title={`Pedido #${String(row.number).padStart(3, "0")} · ${row.kind === "DELIVERY" ? "Delivery" : "Take-away"}`} eyebrow={SOURCE_LABEL[row.source] || row.source} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={() => printHtml(`Pedido ${row.number}`, remitoHtml(row))}>Imprimir remito</button>
        {canWrite && !final && <button className="rs-danger-button" onClick={() => setCancelling(true)}>Cancelar pedido</button>}
        {next && (canWrite || (repartidor && ["EN_CAMINO", "ENTREGADO"].includes(next.status))) && <button className="primary-button" disabled={busy} onClick={() => move(next.status)}>{next.label}</button>}
      </>}>
      <div className="r3-detail">
        <div className="r3-chips">
          <Pill tone={STATUS_TONE[row.status] || "gray"}>{row.status_label}</Pill>
          {isLate(row) && <Pill tone="red">Atrasado</Pill>}
          {row.has_allergy && <Pill tone="red">Avisó una alergia</Pill>}
          {row.to_collect > 0 ? <Pill tone="orange">A cobrar {money(row.to_collect)}</Pill> : <Pill tone="green">Pagado</Pill>}
          {row.pending_online_payment && <Pill tone="orange">Pago online pendiente</Pill>}
        </div>
        <div className="r3-detail-cols">
          <div className="r3-kv">
            <strong>{row.customer_name}</strong>
            {row.phone && <span><a href={`tel:${row.phone}`} className="rs-link">{row.phone}</a></span>}
            {row.kind === "DELIVERY" && <>
              <span>{row.address}{row.zone_name ? ` · ${row.zone_name}` : ""}</span>
              {row.address_notes && <small>{row.address_notes}</small>}
              {mapUrl && <a className="rs-link" href={mapUrl} target="_blank" rel="noreferrer">Ver en el mapa</a>}
            </>}
            {row.promised_at && <small>Prometido para las {hhmm(row.promised_at)}</small>}
            {row.notes && <small className="r3-note-line">{row.notes}</small>}
          </div>
          <div className="r3-kv">
            <span>Total <b className="r3-money">{money(row.total)}</b></span>
            {row.fee > 0 && <small>Incluye envío {money(row.fee)}</small>}
            {row.paid > 0 && <span>Pagado <b className="r3-money">{money(row.paid)}</b></span>}
            {row.to_collect > 0 && <span>A cobrar <b className="r3-money">{money(row.to_collect)}</b></span>}
            {row.cancel_reason && <small className="r3-note-line">Cancelado: {row.cancel_reason}</small>}
          </div>
        </div>
        <div className="r3-cart">
          {(row.items || []).map((i, k) => (
            <div key={k} className="r3-cart-line"><div><strong>{i.qty}× {i.name}</strong>{i.modifiers.length > 0 && <small>{i.modifiers.join(", ")}</small>}{i.notes && <small className="r3-note-line">{i.notes}</small>}</div><b className="r3-money">{money(i.line_total)}</b></div>
          ))}
          {row.fee > 0 && <div className="r3-cart-extra"><span>Envío</span><b className="r3-money">{money(row.fee)}</b></div>}
        </div>
        {row.kind === "DELIVERY" && canWrite && !final && (
          <Field label="Repartidor">
            <select value={row.courier_id ?? ""} onChange={(e) => assign(e.target.value)}>
              <option value="">Sin asignar</option>
              {couriers.filter((c) => c.active || c.id === row.courier_id).map((c) => <option key={c.id} value={c.id}>{c.name}{c.active_orders ? ` (${c.active_orders} en curso)` : ""}</option>)}
            </select>
          </Field>
        )}
        {row.kind === "DELIVERY" && !canWrite && row.courier_name && <p className="r2-muted">Repartidor: {row.courier_name}</p>}
        {cancelling && (
          <div className="rs-note rs-note-warn r3-detail">
            <Field label="Motivo de la cancelación"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Se quedó sin stock, el cliente no atiende..." maxLength={200} autoFocus /></Field>
            <div className="r2-btn-row"><button className="secondary-button" onClick={() => setCancelling(false)}>Volver</button><button className="rs-danger-button" disabled={busy || reason.trim().length < 3} onClick={() => move("CANCELADO", reason)}>Confirmar cancelación</button></div>
          </div>
        )}
        {(row.history || []).length > 0 && (
          <details><summary className="rs-link">Historial</summary>
            <ul className="r3-history">{row.history!.map((h, i) => <li key={i}>{dateTime(h.at)} · {h.from ? `${h.from} → ` : ""}{h.to}{h.by ? ` · ${h.by}` : ""}</li>)}</ul>
          </details>
        )}
        {row.pending_online_payment && <p className="r2-muted">Cuando Mercado Pago confirme el pago, el pedido pasa solo a cocina.</p>}
      </div>
    </Modal>
  );
}
