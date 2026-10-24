import { useState } from "react";
import { appApi, money } from "../../config";
import { Empty, Field, Modal, Pill } from "../ui";
import { canCollect, isBoss } from "./hooks";
import { ITEM_STATUS, COURSE_NAMES } from "./types";
import type { KdsTicket, OrderData, OrderItem } from "./types";

const VOID_REASONS = ["Error de carga", "El cliente cambió de idea", "Demora en salir", "Plato en mal estado", "Se agotó"];
const SENT = ["ENVIADO", "EN_PREPARACION", "LISTO", "SERVIDO"];

/** Anular un plato (o toda la cuenta): motivo y, si ya salió a cocina, PIN de un encargado. Queda en la auditoría. */
export function VoidDialog({ title, needPin, needReason, onClose, onConfirm }: {
  title: string; needPin: boolean; needReason: boolean; onClose: () => void; onConfirm: (reason: string, pin: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const askPin = needPin && !isBoss();
  async function go() {
    if (needReason && reason.trim().length < 3) { setError("Elegí o escribí el motivo"); return; }
    if (askPin && !pin.trim()) { setError("Pedile el PIN a un encargado"); return; }
    setBusy(true);
    try { await onConfirm(reason.trim(), pin.trim()); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo anular"); setBusy(false); }
  }
  return (
    <Modal eyebrow="ANULACIÓN" title={title} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="rs-danger-button" disabled={busy} onClick={go}>Anular</button></>}>
      <div className="r2-dialog">
        {needPin && <div className="rs-note rs-note-warn">Ya salió a cocina o barra: queda registrado quién lo anuló y quién lo autorizó.</div>}
        <div className="r2-chips" role="group" aria-label="Motivos frecuentes">
          {VOID_REASONS.map((r) => <button key={r} type="button" className={reason === r ? "is-on" : ""} onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <Field label={needReason ? "Motivo" : "Motivo (opcional)"}><input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="Escribí el motivo" /></Field>
        {askPin && <Field label="PIN de un encargado"><input type="password" inputMode="numeric" autoComplete="off" value={pin} maxLength={8} onChange={(e) => setPin(e.target.value)} /></Field>}
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

type Dlg = null | { kind: "void"; item: OrderItem } | { kind: "cancel" } | { kind: "move" } | { kind: "merge" } | { kind: "transfer" } | { kind: "info" };

/**
 * La cuenta de una mesa o de una venta de mostrador: ítems por tiempo, estados, acciones y totales.
 * `onOrder` recibe la cuenta actualizada después de cada acción.
 */
export default function OrderPanel({ order, free, openOrders, waiters, onOrder, onFail, onOk, onPrintComanda, onPrecheck, onPay, onClose, onAddMore, readOnlyBy }: {
  order: OrderData;
  free?: { id: number; name: string; area: string }[];
  openOrders?: { id: number; title: string }[];
  waiters?: { id: number; name: string }[];
  onOrder: (o: OrderData) => void; onFail: (e: unknown) => void; onOk: (m: string) => void;
  onPrintComanda: (tickets: KdsTicket[]) => void; onPrecheck?: (o: OrderData) => void; onPay: (o: OrderData) => void;
  onClose?: () => void; onAddMore?: () => void;
  /** Nombre del mozo que atiende la mesa, si no es quien la mira: solo lectura (regla 8) */
  readOnlyBy?: string | null;
}) {
  const [dlg, setDlg] = useState<Dlg>(null);
  const [busy, setBusy] = useState(false);
  const closed = order.status === "PAGADO" || order.status === "ANULADO";
  const locked = closed || !!readOnlyBy;
  const isTable = order.channel !== "MOSTRADOR";

  async function run<T>(fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(true);
    try { const r = await fn(); after?.(r); } catch (e) { onFail(e); } finally { setBusy(false); }
  }
  const post = (path: string, body: unknown = {}, method = "POST") => appApi(`/orders/${order.id}${path}`, { method, body });

  const visible = order.items.filter((i) => i.status !== "POR_CONFIRMAR");
  const toConfirm = order.items.filter((i) => i.status === "POR_CONFIRMAR");
  const courses = Array.from(new Set(visible.map((i) => i.course))).sort((a, b) => a - b);

  const send = () => run(() => post("/send", {}), (r: any) => { onOrder(r.order); if (r.tickets?.length) onPrintComanda(r.tickets); onOk("Enviado a cocina"); });
  const fire = () => run(() => post("/fire-course", {}), (r: any) => { onOrder(r.order); if (r.tickets?.length) onPrintComanda(r.tickets); onOk("Marchó el siguiente tiempo"); });
  const step = (it: OrderItem, d: number) => {
    const q = Math.max(1, Math.min(99, it.qty + d));
    if (q !== it.qty) run(() => post(`/items/${it.id}`, { qty: q }, "PATCH"), onOrder);
  };
  const served = (it: OrderItem) => run(() => appApi(`/kds/items/${it.id}`, { method: "PATCH", body: { status: "SERVIDO" } }).then(() => appApi(`/orders/${order.id}`)), onOrder);
  const confirmQr = (send: boolean) => run(() => appApi("/orders/items/confirm", { method: "POST", body: { item_ids: toConfirm.map((i) => i.id), send } }),
    (r: any) => { if (r.orders?.[0]) onOrder(r.orders[0]); if (r.tickets?.length) onPrintComanda(r.tickets); onOk("Pedido de la mesa confirmado"); });

  const isSent = (it: OrderItem) => SENT.includes(it.status);
  const ask = order.status === "CUENTA_PEDIDA";

  return (
    <div className="r2-order">
      <div className="r2-order-head">
        <div>
          <h2>{order.title}</h2>
          <div className="r2-order-meta">
            <Pill tone={ask ? "orange" : closed ? "gray" : "green"}>{ask ? "Pidió la cuenta" : order.status === "PAGADO" ? "Cobrada" : order.status === "ANULADO" ? "Anulada" : "Abierta"}</Pill>
            {order.waiter_name && <Pill>{order.waiter_name}</Pill>}
            {isTable && <Pill>{order.covers} comensal{order.covers === 1 ? "" : "es"}</Pill>}
            <Pill>{order.minutes_open} min</Pill>
            {order.customer_name && <Pill tone="blue">{order.customer_name}</Pill>}
          </div>
        </div>
        {onClose && <button className="secondary-button r2-btn-sm" onClick={onClose}>Cerrar</button>}
      </div>

      {order.notes && <div className="rs-note rs-note-info">{order.notes}</div>}

      {toConfirm.length > 0 && !locked && (
        <div className="r2-qr-box" role="region" aria-label="Pedidos de la mesa por confirmar">
          <strong>La mesa pidió por QR ({toConfirm.length})</strong>
          {toConfirm.map((i) => (
            <div key={i.id}>{i.qty} x {i.name}{i.notes ? ` · ${i.notes}` : ""} <button className="r2-mini is-danger" onClick={() => setDlg({ kind: "void", item: i })}>Rechazar</button></div>
          ))}
          <div className="r2-btn-row">
            <button className="primary-button r2-btn-sm" disabled={busy} onClick={() => confirmQr(true)}>Confirmar y enviar</button>
            <button className="secondary-button r2-btn-sm" disabled={busy} onClick={() => confirmQr(false)}>Solo confirmar</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="r2-items"><div className="r2-order-empty">Todavía no cargaste nada. Elegí platos de la carta.{onAddMore && <div style={{ marginTop: 10 }}><button className="primary-button r2-btn-sm" onClick={onAddMore}>Abrir la carta</button></div>}</div></div>
      ) : (
        <div className="r2-items">
          {courses.map((c) => (
            <div key={c}>
              {courses.length > 1 && <div className="r2-course"><span>{COURSE_NAMES[c] || `Tiempo ${c}`}</span>{visible.some((i) => i.course === c && i.status === "PENDIENTE") && <span>En espera</span>}</div>}
              {visible.filter((i) => i.course === c).map((it) => {
                const st = ITEM_STATUS[it.status] || { label: it.status, tone: "gray" };
                const void_ = it.status === "ANULADO";
                return (
                  <div key={it.id} className={`r2-item ${void_ ? "is-void" : ""}`}>
                    <div>
                      <div className="r2-item-name"><span className="qty">{it.qty}×</span>{it.name} <Pill tone={st.tone}>{st.label}</Pill></div>
                      {it.modifiers.map((m, k) => <div key={k} className="r2-item-sub">+ {m.name}{m.price_delta ? ` (${money(m.price_delta)})` : ""}</div>)}
                      {(it.combo_items || []).map((c2) => <div key={c2.id} className="r2-item-sub">· {c2.name}</div>)}
                      {it.notes && <div className="r2-item-note">{it.notes}</div>}
                      {it.allergy_alert && !void_ && <span className="r2-item-alert">Alergia / celíaco</span>}
                      {void_ && it.void_reason && <div className="r2-item-sub">Motivo: {it.void_reason}</div>}
                      {it.comped && <div className="r2-item-sub">Cortesía</div>}
                    </div>
                    <div className="r2-item-price r2-money">{it.comped ? "Cortesía" : money(it.line_total)}</div>
                    {!void_ && !locked && (
                      <div className="r2-item-actions">
                        {it.status === "PENDIENTE" && (
                          <span className="r2-mini-step"><button aria-label="Menos" onClick={() => step(it, -1)}>−</button><span>{it.qty}</span><button aria-label="Más" onClick={() => step(it, 1)}>+</button></span>
                        )}
                        {it.status === "LISTO" && <button className="r2-mini is-ok" onClick={() => served(it)}>Servido</button>}
                        <button className="r2-mini is-danger" onClick={() => setDlg({ kind: "void", item: it })}>{isSent(it) ? "Anular" : "Quitar"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="r2-totals">
        <div className="is-muted"><span>Subtotal</span><span className="r2-money">{money(order.subtotal)}</span></div>
        {order.discount_total > 0 && <div className="is-muted"><span>Descuentos</span><span className="r2-money">−{money(order.discount_total)}</span></div>}
        {order.cover_charge > 0 && <div className="is-muted"><span>Cubierto{order.cover_text ? ` (${order.cover_text})` : ""}</span><span className="r2-money">{money(order.cover_charge)}</span></div>}
        <div className="is-total"><span>Total</span><span className="r2-money">{money(order.total)}</span></div>
        {order.paid > 0 && <div className="is-muted"><span>Cobrado</span><span className="r2-money">{money(order.paid)}</span></div>}
        {order.paid > 0 && !closed && <div><span>Falta cobrar</span><strong className="r2-money">{money(order.balance)}</strong></div>}
        {order.settings.tip_enabled && order.balance > 0 && <div className="is-muted"><span>Propina sugerida {order.settings.tip_default_pct}% (voluntaria, aparte)</span><span className="r2-money">{money(order.suggested_tip)}</span></div>}
      </div>

      {readOnlyBy && !closed && <div className="rs-note rs-note-info">Esta mesa la atiende {readOnlyBy}. Podés verla, pero no cargar ni cambiar nada. Si hace falta, pedile a un encargado que te la pase.</div>}
      {!locked && (
        <>
          <div className="r2-btn-row">
            {order.unsent > 0 && <button className="primary-button" disabled={busy} onClick={send}>Enviar a cocina ({order.unsent})</button>}
            {order.next_course && order.unsent === 0 && <button className="primary-button" disabled={busy} onClick={fire}>Marchar {COURSE_NAMES[order.next_course] || `tiempo ${order.next_course}`}</button>}
            {order.next_course && order.unsent > 0 && <button className="secondary-button" disabled={busy} onClick={fire}>Marchar {COURSE_NAMES[order.next_course]}</button>}
            {onAddMore && <button className="secondary-button" onClick={onAddMore}>Agregar</button>}
            {isTable && !ask && onPrecheck && <button className="secondary-button" disabled={busy} onClick={() => run(() => post("/precheck"), (o: OrderData) => { onOrder(o); onPrecheck(o); })}>Pedir la cuenta</button>}
            {isTable && ask && onPrecheck && <button className="secondary-button" onClick={() => onPrecheck(order)}>Imprimir precuenta</button>}
            {ask && <button className="secondary-button" disabled={busy} onClick={() => run(() => post("/reopen"), onOrder)}>Reabrir</button>}
            {canCollect() && <button className="primary-button" disabled={busy || order.total <= 0 && order.items.length === 0} onClick={() => onPay(order)}>Cobrar</button>}
          </div>
          <div className="r2-more">
            <button className="r2-mini" onClick={() => setDlg({ kind: "info" })}>Datos de la cuenta</button>
            {isTable && <button className="r2-mini" onClick={() => setDlg({ kind: "move" })}>Mover de mesa</button>}
            {isTable && <button className="r2-mini" onClick={() => setDlg({ kind: "merge" })}>Unir cuentas</button>}
            {isTable && <button className="r2-mini" onClick={() => setDlg({ kind: "transfer" })}>Pasar a otro mozo</button>}
            <button className="r2-mini is-danger" onClick={() => setDlg({ kind: "cancel" })}>Anular la cuenta</button>
          </div>
        </>
      )}
      {closed && <Empty title={order.status === "PAGADO" ? "Cuenta cobrada" : "Cuenta anulada"}>{order.void_reason}</Empty>}

      {dlg?.kind === "void" && (
        <VoidDialog title={`${dlg.item.qty}× ${dlg.item.name}`} needPin={isSent(dlg.item)} needReason={isSent(dlg.item) || order.settings.require_void_reason}
          onClose={() => setDlg(null)}
          onConfirm={async (reason, pin) => { const o = await post(`/items/${dlg.item.id}/void`, { reason: reason || null, pin: pin || null }); onOrder(o); setDlg(null); onOk("Anulado y registrado"); }} />
      )}
      {dlg?.kind === "cancel" && (
        <VoidDialog title={`Anular ${order.title}`} needPin={order.items.some((i) => isSent(i) && i.status !== "ANULADO")} needReason={order.items.some((i) => i.status !== "ANULADO")}
          onClose={() => setDlg(null)}
          onConfirm={async (reason, pin) => { const o = await post("/cancel", { reason: reason || null, pin: pin || null }); onOrder(o); setDlg(null); onOk("Cuenta anulada"); }} />
      )}
      {dlg?.kind === "move" && (
        <Modal eyebrow="MOVER" title="¿A qué mesa la pasás?" onClose={() => setDlg(null)}>
          {(free || []).length === 0 ? <Empty title="No hay mesas libres">Cuando se libere una, podés pasarla.</Empty> : (
            <div className="r2-pick-list">{(free || []).map((t) => <button key={t.id} onClick={() => run(() => post("/move", { table_id: t.id }), (o: OrderData) => { onOrder(o); setDlg(null); onOk(`Pasó a la mesa ${t.name}`); })}>{t.name}<small>{t.area}</small></button>)}</div>
          )}
        </Modal>
      )}
      {dlg?.kind === "merge" && (
        <Modal eyebrow="UNIR" title="¿Con qué cuenta la unís?" onClose={() => setDlg(null)}>
          {(openOrders || []).filter((o) => o.id !== order.id).length === 0 ? <Empty title="No hay otras cuentas abiertas" /> : (
            <div className="r2-pick-list">{(openOrders || []).filter((o) => o.id !== order.id).map((o) => <button key={o.id} onClick={() => run(() => post("/merge", { target_order_id: o.id }), (r: OrderData) => { onOrder(r); setDlg(null); onOk("Cuentas unidas"); })}>{o.title}</button>)}</div>
          )}
          <p className="rs-muted">Los platos de esta cuenta se suman a la que elijas.</p>
        </Modal>
      )}
      {dlg?.kind === "transfer" && (
        <Modal eyebrow="PASAR" title="¿A qué mozo se la pasás?" onClose={() => setDlg(null)}>
          <div className="r2-pick-list">{(waiters || []).filter((w) => w.id !== order.waiter_id).map((w) => <button key={w.id} onClick={() => run(() => post("/transfer-waiter", { waiter_id: w.id }), (o: OrderData) => { onOrder(o); setDlg(null); onOk(`Ahora la atiende ${w.name}`); })}>{w.name}</button>)}</div>
        </Modal>
      )}
      {dlg?.kind === "info" && <InfoDialog order={order} onClose={() => setDlg(null)} onSave={(body) => run(() => post("", body, "PATCH"), (o: OrderData) => { onOrder(o); setDlg(null); })} />}
    </div>
  );
}

function InfoDialog({ order, onClose, onSave }: { order: OrderData; onClose: () => void; onSave: (b: { covers?: number; customer_name?: string | null; notes?: string | null }) => void }) {
  const [covers, setCovers] = useState(String(order.covers || 1));
  const [name, setName] = useState(order.customer_name || "");
  const [notes, setNotes] = useState(order.notes || "");
  const isTable = order.channel !== "MOSTRADOR";
  return (
    <Modal eyebrow="CUENTA" title={order.title} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={() => onSave({ ...(isTable ? { covers: Math.max(1, Number(covers) || 1) } : {}), customer_name: name.trim() || null, notes: notes.trim() || null })}>Guardar</button></>}>
      <div className="r2-dialog">
        {isTable && <Field label="Comensales"><input type="number" min={1} max={60} value={covers} onChange={(e) => setCovers(e.target.value)} /></Field>}
        <Field label={isTable ? "A nombre de (opcional)" : "A nombre de"}><input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Nota de la mesa (sale en la comanda)"><input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Cumpleaños, apuro, sin sal en toda la mesa…" /></Field>
      </div>
    </Modal>
  );
}
