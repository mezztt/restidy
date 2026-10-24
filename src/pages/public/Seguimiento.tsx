import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { publicApi, dateTime, hhmm, money, longDate, parseDay } from "../../config";
import { Shell } from "../../components/public/Shell";
import type { Venue } from "../../components/r3/types";

interface OrderTrack {
  type: "pedido"; token: string; number: number; kind: string; status: string; status_label: string; customer_name: string; address: string | null; zone_name: string | null;
  steps: { key: string; label: string; done: boolean; current: boolean }[]; items: { name: string; qty: number; line_total: number; modifiers: string[]; notes: string | null }[];
  subtotal: number; fee: number; total: number; paid: number; pending_payment: boolean; pay_pending_until: string | null; promised_at: string | null; cancel_reason: string | null;
  can_cancel: boolean; paid_online: boolean; venue: Venue;
}
interface ResTrack {
  type: "reserva"; token: string; status: string; status_label: string; customer_name: string; party_size: number; date: string; time: string; duration_min: number; notes: string | null;
  deposit_amount: number; deposit_status: string; deposit_expires_at: string | null; can_cancel: boolean; cancel_until: string; cancel_hours: number; refund_policy: string | null;
  cancel_reason: string | null; venue: Venue; pay_pending: boolean;
}
type Track = OrderTrack | ResTrack;

/** Seguimiento de un pedido o una reserva por su enlace privado */
export default function Seguimiento() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [t, setT] = useState<Track | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const back = params.get("pago") === "1";

  const load = useCallback(() => {
    publicApi<Track>(`/public/track/${token}`).then((d) => { setT(d); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "No encontramos el seguimiento"));
  }, [token]);
  const waiting = !!t && ((t.type === "pedido" && t.pending_payment) || (t.type === "reserva" && t.pay_pending));
  const active = !t || !["ENTREGADO", "RETIRADO", "CANCELADO", "COMPLETADA", "CANCELADA", "NO_SHOW"].includes(t.status);
  useEffect(() => { load(); const i = window.setInterval(() => !document.hidden && active && load(), waiting || back ? 4000 : 12000); return () => window.clearInterval(i); }, [load, active, waiting, back]);

  async function cancel() {
    setBusy(true); setMsg("");
    try { const d = await publicApi<Track>(`/public/track/${token}/cancel`, { method: "POST", body: { reason: reason.trim() || null } }); setT(d); setAsking(false); }
    catch (e) { setMsg(e instanceof Error ? e.message : "No pudimos cancelar"); } finally { setBusy(false); }
  }
  async function payAgain() {
    setBusy(true); setMsg("");
    try { const r = await publicApi<{ checkout_url: string }>(`/public/track/${token}/pay`, { method: "POST" }); window.location.href = r.checkout_url; }
    catch (e) { setMsg(e instanceof Error ? e.message : "No pudimos abrir el pago"); setBusy(false); }
  }

  const cancelBox = (what: string) => asking ? (
    <div className="r3-pub-note">
      <div className="pb-field"><label htmlFor="mot">Motivo (opcional)</label><input id="mot" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <div className="r3-pub-tools" style={{ marginBottom: 0 }}><button className="pb-btn pb-btn-ghost" onClick={() => setAsking(false)}>Volver</button><button className="pb-btn" disabled={busy} onClick={cancel}>Sí, cancelar {what}</button></div>
    </div>
  ) : <button className="pb-btn pb-btn-ghost" onClick={() => setAsking(true)}>Cancelar {what}</button>;

  return (
    <Shell title="Seguimiento" venue={t?.venue || null} heading={t ? (t.type === "pedido" ? `Pedido #${String(t.number).padStart(3, "0")}` : "Tu reserva") : "Seguimiento"} intro="Guardá este enlace: desde acá ves cómo va todo." error={error && !t ? error : undefined}>
      {t?.type === "pedido" && (
        <>
          {back && t.pending_payment && <div className="r3-pub-note" role="status">Estamos verificando tu pago con Mercado Pago. Esta pantalla se actualiza sola.</div>}
          {back && t.paid_online && t.status !== "CANCELADO" && <div className="r3-pub-ok" role="status">¡Pago confirmado! Tu pedido ya está en marcha.</div>}
          <div className="pb-card">
            <p className="r3-pub-status">{t.status_label}</p>
            {t.promised_at && !["ENTREGADO", "RETIRADO", "CANCELADO"].includes(t.status) && <p className="r3-pub-legal" style={{ margin: "0 0 8px" }}>Hora estimada: {hhmm(t.promised_at)}</p>}
            {t.cancel_reason && <div className="pb-error">Cancelado: {t.cancel_reason}</div>}
            {t.steps.length > 0 && <ol className="r3-pub-steps">{t.steps.map((s) => <li key={s.key} className={s.done ? "is-done" : s.current ? "is-now" : ""}><i />{s.label}</li>)}</ol>}
            {t.pending_payment && (
              <div className="r3-pub-note">Falta pagar para que el local empiece a prepararlo{t.pay_pending_until ? ` (hasta las ${hhmm(t.pay_pending_until)})` : ""}.
                <div style={{ marginTop: 8 }}><button className="pb-btn" disabled={busy} onClick={payAgain}>Pagar con Mercado Pago</button></div></div>
            )}
          </div>
          <div className="pb-card">
            <span className="pb-step-label">{t.kind === "DELIVERY" ? "Te lo llevamos a" : "Lo retirás en el local"}</span>
            {t.kind === "DELIVERY" && <p style={{ margin: "0 0 10px", color: "#2b1511" }}>{t.address}{t.zone_name ? ` (${t.zone_name})` : ""}</p>}
            {t.items.map((i, k) => <div key={k} className="r3-pub-item" style={{ padding: "8px 0" }}><div><strong>{i.qty}× {i.name}</strong>{i.modifiers.length > 0 && <p>{i.modifiers.join(", ")}</p>}{i.notes && <p>{i.notes}</p>}</div><span className="price">{money(i.line_total)}</span></div>)}
            {t.fee > 0 && <div className="r3-pub-item" style={{ padding: "8px 0" }}><span style={{ color: "#2b1511" }}>Envío</span><span className="price">{money(t.fee)}</span></div>}
            <div className="r3-pub-item" style={{ borderBottom: 0 }}><strong>Total</strong><span className="price">{money(t.total)}</span></div>
            <p className="r3-pub-legal" style={{ margin: 0 }}>{t.paid_online ? "Pagado online." : t.kind === "DELIVERY" ? "Pagás al recibir." : "Pagás al retirar."}</p>
          </div>
          {msg && <div className="pb-error" role="alert">{msg}</div>}
          {t.can_cancel && <div className="pb-card">{cancelBox("el pedido")}</div>}
          {!t.can_cancel && ["CONFIRMADO", "EN_PREPARACION", "LISTO"].includes(t.status) && <p className="r3-pub-legal">Para cambiar o cancelar, llamá al local{t.venue.phone ? ` al ${t.venue.phone}` : ""}.</p>}
        </>
      )}
      {t?.type === "reserva" && (
        <>
          {back && t.status === "CONFIRMADA" && <div className="r3-pub-ok" role="status">¡Seña recibida! Tu reserva está confirmada.</div>}
          {back && t.pay_pending && <div className="r3-pub-note" role="status">Estamos verificando tu pago con Mercado Pago. Esta pantalla se actualiza sola.</div>}
          <div className="pb-card">
            <p className="r3-pub-status">{t.status_label}</p>
            <p style={{ margin: "0 0 4px", color: "#2b1511", fontSize: 17, fontWeight: 700 }}>{longDate(parseDay(t.date))} · {t.time} h</p>
            <p style={{ margin: 0, color: "#66504a" }}>{t.customer_name} · {t.party_size} {t.party_size === 1 ? "persona" : "personas"}{t.notes ? ` · ${t.notes}` : ""}</p>
            {t.cancel_reason && <div className="pb-error" style={{ marginTop: 10 }}>Cancelada: {t.cancel_reason}</div>}
            {t.deposit_amount > 0 && <p className="r3-pub-legal">Seña {money(t.deposit_amount)}: {t.deposit_status === "APROBADA" ? "pagada" : t.deposit_status === "DEVUELTA" ? "devuelta" : "pendiente"}.</p>}
            {t.pay_pending && (
              <div className="r3-pub-note">La mesa se te guarda hasta las {t.deposit_expires_at ? hhmm(t.deposit_expires_at) : "..."} mientras pagás la seña.
                <div style={{ marginTop: 8 }}><button className="pb-btn" disabled={busy} onClick={payAgain}>Pagar la seña</button></div></div>
            )}
          </div>
          {msg && <div className="pb-error" role="alert">{msg}</div>}
          {t.can_cancel ? <div className="pb-card">{cancelBox("la reserva")}<p className="r3-pub-legal">Podés cancelar hasta el {dateTime(t.cancel_until)} ({t.cancel_hours} h antes).{t.refund_policy ? ` ${t.refund_policy}` : ""}</p></div>
            : ["CONFIRMADA", "PENDIENTE_SENIA"].includes(t.status) && <p className="r3-pub-legal">Ya no se puede cancelar online. Llamá al local{t.venue.phone ? ` al ${t.venue.phone}` : ""}.</p>}
        </>
      )}
      {!t && !error && <div className="pb-card"><div className="pb-soon"><b>Buscando tu seguimiento...</b></div></div>}
    </Shell>
  );
}
