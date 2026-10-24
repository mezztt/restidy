import { useEffect, useMemo, useRef, useState } from "react";
import { PAYMENT_METHODS, appApi, money } from "../../config";
import { Field, Modal, Pill, Tabs } from "../ui";
import { isBoss } from "../salon/hooks";
import type { OrderData, Payment } from "../salon/types";
import type { PrintDoc } from "../../pages/print/Ticket80";
import QrCode from "./QrCode";

interface Part { label: string; amount: number; items: { order_item_id: number; qty_fraction: number; amount: number }[]; done?: boolean }
interface Cust { id: number; name: string; balance?: number }

const METHODS: [string, string, string][] = [
  ["EFECTIVO", "Efectivo", "con vuelto"], ["DEBITO", "Débito", ""], ["CREDITO", "Crédito", ""], ["TRANSFERENCIA", "Transferencia", ""],
  ["MERCADOPAGO", "Mercado Pago", "link y QR"], ["QR", "Otro QR", "anotar operación"], ["CUENTA_CORRIENTE", "Cuenta corriente", "a nombre de un cliente"],
];
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (s: string) => { const n = Number(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

/** Cobro de una cuenta: total o dividida, propina voluntaria aparte, todos los medios y Mercado Pago con QR. */
export default function CobroModal({ order, onClose, onOrder, onPrint, onFail, onOk }: {
  order: OrderData; onClose: () => void; onOrder: (o: OrderData) => void; onPrint: (d: PrintDoc[]) => void; onFail: (e: unknown) => void; onOk: (m: string) => void;
}) {
  const [tab, setTab] = useState<"cobrar" | "dividir" | "ajustes">("cobrar");
  const [method, setMethod] = useState("EFECTIVO");
  const [amount, setAmount] = useState(String(order.balance));
  const [tipMode, setTipMode] = useState<number | "otro">(0);
  const [tipOther, setTipOther] = useState("");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [fiscal, setFiscal] = useState("");
  const [pin, setPin] = useState("");
  const [custId, setCustId] = useState("");
  const [custs, setCusts] = useState<Cust[] | null>(null);
  const [part, setPart] = useState<{ label: string; items: Part["items"]; index: number } | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ change: number; closed: boolean } | null>(null);
  const [mp, setMp] = useState<{ payment: Payment; link: string; webhook: boolean } | null>(null);
  const [refund, setRefund] = useState<Payment | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const bal = order.balance;
  const net = Math.max(0, order.subtotal - order.discount_total);
  const frac = part && order.total > 0 ? Number(amount) / order.total : 1;
  const tipOptions = order.settings.tip_options.filter((p) => p > 0);
  const amountN = num(amount);
  const tipN = !order.settings.tip_enabled || method === "CUENTA_CORRIENTE" ? 0 : tipMode === "otro" ? num(tipOther) : r2(net * (tipMode / 100) * (bal > 0 ? Math.min(1, amountN / bal) : 1));
  const receivedN = received === "" ? amountN + tipN : num(received);
  const change = method === "EFECTIVO" ? Math.max(0, r2(receivedN - Math.min(amountN, bal) - tipN)) : 0;
  void frac;

  useEffect(() => { setAmount(String(order.balance)); }, [order.balance]);
  useEffect(() => {
    if (method === "CUENTA_CORRIENTE" && custs === null) {
      appApi<any>("/customers?limit=300").then((r) => setCusts(Array.isArray(r) ? r : (r.items || []))).catch(() => setCusts([]));
    }
  }, [method, custs]);

  // Mercado Pago: se consulta hasta que el pago aparezca aprobado (el aviso automático o la verificación directa)
  useEffect(() => {
    if (!mp) return;
    let stop = false;
    const t = window.setInterval(async () => {
      try {
        const r = await appApi<{ payment: Payment; approved: boolean }>(`/payments/${mp.payment.id}/check`, { method: "POST", body: {} });
        if (stop || !alive.current) return;
        if (r.approved) {
          const o = await appApi<OrderData>(`/orders/${order.id}`);
          setMp(null); onOrder(o); onOk("Mercado Pago aprobó el pago");
          setDone({ change: 0, closed: o.status === "PAGADO" });
        }
      } catch { /* se reintenta */ }
    }, 5000);
    return () => { stop = true; window.clearInterval(t); };
  }, [mp, order.id, onOrder, onOk]);

  const mpExpired = mp?.payment.mp_expires_at ? new Date(mp.payment.mp_expires_at).getTime() < Date.now() : false;

  async function submit() {
    setError("");
    if (amountN <= 0) { setError("Poné cuánto cobrás"); return; }
    if (method !== "EFECTIVO" && amountN > bal + 0.001) { setError(`Ese medio no puede cobrar más que el saldo (${money(bal)})`); return; }
    if (method === "EFECTIVO" && receivedN < Math.min(amountN, bal) + tipN - 0.001) { setError("El efectivo recibido no alcanza"); return; }
    if (method === "QR" && !reference.trim()) { setError("Anotá el número de operación"); return; }
    if (method === "CUENTA_CORRIENTE" && !custId) { setError("Elegí el cliente"); return; }
    if (method === "CUENTA_CORRIENTE" && !isBoss() && !pin.trim()) { setError("La cuenta corriente la autoriza un encargado: pedile el PIN"); return; }
    setBusy(true);
    try {
      if (method === "MERCADOPAGO") {
        const r = await appApi<{ payment: Payment; link: string; webhook: boolean }>(`/orders/${order.id}/payments/mp-link`, { method: "POST", body: { amount: amountN, back_url: `${window.location.origin}/app/caja` } });
        setMp(r);
        return;
      }
      const r = await appApi<{ payment: Payment; closed: boolean; change: number; order: OrderData }>(`/orders/${order.id}/payments`, {
        method: "POST", body: {
          method, amount: amountN, tip_amount: tipN, received: method === "EFECTIVO" ? receivedN : null, reference: reference.trim() || null,
          split_label: part?.label || null, fiscal_ref: fiscal.trim() || null, customer_id: custId ? Number(custId) : null, pin: pin.trim() || null,
          items: part?.items || [],
        },
      });
      if (part) setParts((ps) => ps.map((p, i) => (i === part.index ? { ...p, done: true } : p)));
      setPart(null); setReceived(""); setReference(""); setPin(""); setTipMode(0); setTipOther("");
      onOrder(r.order);
      setDone({ change: r.change, closed: r.closed });
      if (!r.closed) { onOk(`Cobro registrado: ${money(r.payment.amount)}`); setDone(null); setTab("cobrar"); }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar el cobro"); } finally { setBusy(false); }
  }

  async function adjust(path: string, body: unknown, method = "POST") {
    setBusy(true); setError("");
    try { const o = await appApi<OrderData>(`/orders/${order.id}${path}`, { method, body }); onOrder(o); onOk("Listo"); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo hacer el cambio"); return false; } finally { setBusy(false); }
  }

  if (done?.closed) {
    return (
      <Modal eyebrow="COBRADA" title={order.title} onClose={onClose} footer={<>
        <button className="secondary-button" onClick={() => onPrint([{ kind: "ticket", order }])}>Imprimir ticket</button>
        <button className="primary-button" onClick={onClose}>Listo</button></>}>
        <div className="r2-done">
          <h3>Cuenta cobrada</h3>
          {done.change > 0 && <div className="r2-change">Vuelto: {money(done.change)}</div>}
          <div className="r2-pay-total"><span>Total</span><strong>{money(order.total)}</strong></div>
          <div className="rs-note rs-note-info" style={{ textAlign: "left" }}>El ticket dice «Documento no válido como factura». Si emitís la factura por afuera, anotá acá el comprobante.</div>
          <Field label="Comprobante emitido afuera (tipo y número)"><input value={order.fiscal_ref || fiscal} maxLength={80} placeholder="Factura B 0001-00001234" onChange={(e) => setFiscal(e.target.value)} /></Field>
          <button className="secondary-button" onClick={async () => { await adjust("/fiscal-ref", { fiscal_ref: fiscal.trim() || null }, "PATCH"); }}>Guardar comprobante</button>
        </div>
      </Modal>
    );
  }

  const paidRows = order.payments.filter((p) => p.status === "APROBADO" || p.status === "PENDIENTE");
  return (
    <Modal eyebrow="COBRAR" title={order.title} size="wide" onClose={onClose}>
      <Tabs value={tab} onChange={setTab} options={[["cobrar", "Cobrar"], ["dividir", "Dividir la cuenta"], ["ajustes", "Descuentos y cubierto"]]} />
      <div className="r2-pay">
        <div className="r2-pay-total">
          <span>{order.paid > 0 ? "Falta cobrar" : "Total de la cuenta"}</span>
          <strong className="r2-money">{money(bal)}</strong>
          {order.paid > 0 && <span>Total {money(order.total)} · ya se cobró {money(order.paid)}</span>}
        </div>
        {paidRows.length > 0 && (
          <div className="r2-paid-list">
            {paidRows.map((p) => (
              <div key={p.id}><span>{PAYMENT_METHODS[p.method] || p.method}{p.split_label ? ` · ${p.split_label}` : ""} {p.status === "PENDIENTE" && <Pill tone="orange">Esperando pago</Pill>}</span>
                <span>{money(p.amount)}{p.tip_amount ? ` + propina ${money(p.tip_amount)}` : ""} {p.status === "APROBADO" && <button className="r2-mini" onClick={() => setRefund(p)}>Devolver</button>}</span></div>
            ))}
          </div>
        )}
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}

        {tab === "cobrar" && bal <= 0 && (
          <div className="rs-note rs-note-info">No queda saldo. {order.items.length > 0 && <button className="primary-button r2-btn-sm" disabled={busy} onClick={async () => { if (await adjust("/close", {})) setDone({ change: 0, closed: true }); }}>Cerrar la cuenta</button>}</div>
        )}

        {tab === "cobrar" && bal > 0 && !mp && (
          <>
            {part && <div className="rs-note rs-note-info">Cobrando: <strong>{part.label}</strong>. <button className="r2-mini" onClick={() => { setPart(null); setAmount(String(bal)); }}>Cobrar otra cosa</button></div>}
            <Field label="Medio de pago">
              <div className="r2-methods" role="radiogroup" aria-label="Medio de pago">
                {METHODS.map(([k, name, sub]) => {
                  const off = k === "MERCADOPAGO" && !order.settings.mp_configured;
                  return <button key={k} type="button" role="radio" aria-checked={method === k} className={method === k ? "is-on" : ""} disabled={off} onClick={() => setMethod(k)}>{name}<small>{off ? "falta el token en Configuración" : sub}</small></button>;
                })}
              </div>
            </Field>
            <div className="r2-two">
              <Field label="Importe a cobrar"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              {method === "EFECTIVO" && <Field label="Efectivo recibido"><input inputMode="decimal" value={received} placeholder={String(r2(amountN + tipN))} onChange={(e) => setReceived(e.target.value)} /></Field>}
              {(method === "DEBITO" || method === "CREDITO" || method === "TRANSFERENCIA") && <Field label="Cupón o referencia (opcional)"><input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} /></Field>}
              {method === "QR" && <Field label="Número de operación"><input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} /></Field>}
            </div>
            {method === "EFECTIVO" && change > 0 && <div className="r2-change">Vuelto: {money(change)}</div>}
            {method === "CUENTA_CORRIENTE" && (
              <div className="r2-two">
                <Field label="Cliente">
                  <select value={custId} onChange={(e) => setCustId(e.target.value)}>
                    <option value="">Elegí un cliente</option>
                    {(custs || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {custs && custs.length === 0 && <small className="rs-hint">No hay clientes cargados (o no tenés acceso). Cargalos en Clientes.</small>}
                </Field>
                {!isBoss() && <Field label="PIN de un encargado"><input type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} /></Field>}
              </div>
            )}
            {order.settings.tip_enabled && method !== "CUENTA_CORRIENTE" && method !== "MERCADOPAGO" && (
              <Field label="Propina voluntaria (va aparte, no suma al total)">
                <div className="r2-chips" role="group" aria-label="Propina">
                  <button type="button" className={tipMode === 0 ? "is-on" : ""} onClick={() => setTipMode(0)}>Sin propina</button>
                  {tipOptions.map((p) => <button key={p} type="button" className={tipMode === p ? "is-on" : ""} onClick={() => setTipMode(p)}>{p}%</button>)}
                  <button type="button" className={tipMode === "otro" ? "is-on" : ""} onClick={() => setTipMode("otro")}>Otro monto</button>
                </div>
                {tipMode === "otro" && <input style={{ marginTop: 8 }} inputMode="decimal" placeholder="Monto de propina" value={tipOther} onChange={(e) => setTipOther(e.target.value)} />}
                {tipN > 0 && <small className="rs-hint">Propina: {money(tipN)}. El cliente paga {money(Math.min(amountN, bal) + tipN)} en total.</small>}
              </Field>
            )}
            <Field label="Comprobante emitido afuera (opcional)" hint="Restidy no emite facturas: el ticket dice «Documento no válido como factura». Si emitís una por afuera, anotá el tipo y número.">
              <input value={fiscal} maxLength={80} placeholder="Factura B 0001-00001234" onChange={(e) => setFiscal(e.target.value)} />
            </Field>
            <button className="primary-button r2-btn-lg" disabled={busy} onClick={submit}>{method === "MERCADOPAGO" ? "Generar link y QR" : `Cobrar ${money(Math.min(amountN, bal) + tipN)}`}</button>
          </>
        )}

        {tab === "cobrar" && mp && (
          <div className="r2-qrbox">
            <strong>Pedile al cliente que escanee el QR con Mercado Pago</strong>
            <QrCode text={mp.link} label="QR de pago de Mercado Pago" />
            <div className="r2-waiting" role="status">{mpExpired ? "El link venció. Generá uno nuevo." : "Esperando el pago… se confirma solo"}</div>
            <div className="r2-btn-row">
              <button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(mp.link).then(() => onOk("Link copiado")).catch(() => onOk("No se pudo copiar")); }}>Copiar link</button>
              <button className="secondary-button" onClick={async () => {
                try { const r = await appApi<{ approved: boolean }>(`/payments/${mp.payment.id}/check`, { method: "POST", body: {} }); if (!r.approved) onOk("Todavía no figura aprobado"); } catch (e) { onFail(e); }
              }}>Ya pagó, verificar</button>
              <button className="secondary-button" onClick={() => setMp(null)}>Elegir otro medio</button>
            </div>
            <small className="rs-hint">El pago se acepta solo cuando Mercado Pago lo confirma. El link vence a los 30 minutos.</small>
          </div>
        )}

        {tab === "dividir" && bal > 0 && <SplitTab order={order} parts={parts} setParts={setParts} onFail={setError}
          onCharge={(p, i) => { setPart({ label: p.label, items: p.items, index: i }); setAmount(String(p.amount)); setTab("cobrar"); }} />}
        {tab === "dividir" && bal <= 0 && <div className="rs-note rs-note-info">La cuenta ya está cobrada.</div>}

        {tab === "ajustes" && <AdjustTab order={order} busy={busy} adjust={adjust} />}
      </div>
      {refund && <RefundDialog payment={refund} onClose={() => setRefund(null)} onDone={(o) => { setRefund(null); if (o) onOrder(o); onOk("Cobro devuelto"); }} />}
    </Modal>
  );
}

function SplitTab({ order, parts, setParts, onCharge, onFail }: { order: OrderData; parts: Part[]; setParts: (p: Part[]) => void; onCharge: (p: Part, i: number) => void; onFail: (m: string) => void }) {
  const [mode, setMode] = useState<"EQUAL" | "ITEMS" | "AMOUNT">("EQUAL");
  const [n, setN] = useState("2");
  const [amounts, setAmounts] = useState("");
  const [who, setWho] = useState<Record<number, string>>({});
  const items = useMemo(() => order.items.filter((i) => ["PENDIENTE", "ENVIADO", "EN_PREPARACION", "LISTO", "SERVIDO"].includes(i.status) && !i.comped), [order]);
  const people = Math.max(2, Math.min(20, Number(n) || 2));

  async function calc() {
    onFail("");
    try {
      let body: any = { mode };
      if (mode === "EQUAL") body.parts = people;
      if (mode === "AMOUNT") body.amounts = amounts.split(/[\s;]+/).filter(Boolean).map((x) => num(x));
      if (mode === "ITEMS") {
        const a: Record<string, Record<string, number>> = {};
        for (const it of items) {
          const w = who[it.id] || "1";
          if (w === "todos") for (let k = 1; k <= people; k++) { (a[`Comensal ${k}`] ||= {})[String(it.id)] = 1 / people; }
          else (a[`Comensal ${w}`] ||= {})[String(it.id)] = 1;
        }
        body.assignments = a;
      }
      const r = await appApi<{ parts: Part[]; complete: boolean }>(`/orders/${order.id}/split`, { method: "POST", body });
      setParts(r.parts.map((p) => ({ ...p })));
      if (!r.complete) onFail("Ojo: todavía quedan ítems sin asignar. Podés cobrar estas partes y dividir el resto después.");
    } catch (e) { onFail(e instanceof Error ? e.message : "No se pudo dividir"); }
  }

  return (
    <div className="r2-pay">
      <div className="rs-seg" role="group" aria-label="Cómo dividir">
        <button className={mode === "EQUAL" ? "is-on" : ""} onClick={() => setMode("EQUAL")}>En partes iguales</button>
        <button className={mode === "ITEMS" ? "is-on" : ""} onClick={() => setMode("ITEMS")}>Por ítem</button>
        <button className={mode === "AMOUNT" ? "is-on" : ""} onClick={() => setMode("AMOUNT")}>Por monto</button>
      </div>
      {mode !== "AMOUNT" && <Field label={mode === "EQUAL" ? "Entre cuántas personas" : "Cantidad de comensales"}><input type="number" min={2} max={20} value={n} onChange={(e) => setN(e.target.value)} /></Field>}
      {mode === "AMOUNT" && <Field label="Montos de cada parte (separados por espacio)" hint={`Tienen que sumar ${money(order.balance)}.`}><input value={amounts} onChange={(e) => setAmounts(e.target.value)} placeholder="5000 7500 8000" /></Field>}
      {mode === "ITEMS" && (
        <div className="r2-parts">
          {items.map((it) => (
            <div key={it.id} className="r2-part"><span>{it.qty}× {it.name} · {money(it.line_total)}</span>
              <select aria-label={`Quién paga ${it.name}`} value={who[it.id] || "1"} onChange={(e) => setWho({ ...who, [it.id]: e.target.value })}>
                {Array.from({ length: people }, (_, k) => <option key={k} value={k + 1}>Comensal {k + 1}</option>)}
                <option value="todos">Se comparte entre todos</option>
              </select></div>
          ))}
        </div>
      )}
      <button className="secondary-button" onClick={calc}>Calcular partes</button>
      {parts.length > 0 && (
        <div className="r2-parts">
          {parts.map((p, i) => (
            <div key={i} className={`r2-part ${p.done ? "is-done" : ""}`}><span><strong>{p.label}</strong> · <span className="r2-money">{money(p.amount)}</span></span>
              {p.done ? <Pill tone="green">Cobrada</Pill> : <button className="primary-button r2-btn-sm" onClick={() => onCharge(p, i)}>Cobrar esta parte</button>}</div>
          ))}
          <small className="rs-hint">En partes iguales, la última absorbe los centavos de diferencia.</small>
        </div>
      )}
    </div>
  );
}

function AdjustTab({ order, busy, adjust }: { order: OrderData; busy: boolean; adjust: (path: string, body: unknown, method?: string) => Promise<boolean> }) {
  const [kind, setKind] = useState<"PCT" | "MONTO">("PCT");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [compId, setCompId] = useState("");
  const [compReason, setCompReason] = useState("");
  const [compPin, setCompPin] = useState("");
  const items = order.items.filter((i) => ["PENDIENTE", "ENVIADO", "EN_PREPARACION", "LISTO", "SERVIDO"].includes(i.status) && !i.comped);
  return (
    <div className="r2-pay">
      <fieldset className="r2-fieldset">
        <legend>Descuento sobre toda la cuenta</legend>
        {order.discounts.map((d) => (
          <div key={d.id} className="r2-part"><span>{d.kind === "PCT" ? `${d.value}%` : money(d.value)} · {d.reason} ({money(d.amount)})</span>
            {isBoss() && <button className="r2-mini is-danger" onClick={() => adjust(`/discount/${d.id}`, undefined, "DELETE")}>Quitar</button>}</div>
        ))}
        <div className="r2-two" style={{ marginTop: 8 }}>
          <Field label="Tipo"><div className="rs-seg"><button className={kind === "PCT" ? "is-on" : ""} onClick={() => setKind("PCT")}>%</button><button className={kind === "MONTO" ? "is-on" : ""} onClick={() => setKind("MONTO")}>$</button></div></Field>
          <Field label={kind === "PCT" ? "Porcentaje" : "Monto"}><input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="Motivo" wide><input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="Cliente frecuente, error de la cocina…" /></Field>
          {!isBoss() && <Field label={`PIN de un encargado (si pasa de ${order.settings.discount_pin_pct}%)`}><input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} /></Field>}
        </div>
        <button className="secondary-button" disabled={busy || !value || !reason.trim()} onClick={async () => { if (await adjust("/discount", { kind, value: num(value), reason, pin: pin || null })) { setValue(""); setReason(""); } }}>Aplicar descuento</button>
      </fieldset>
      <fieldset className="r2-fieldset">
        <legend>Cortesía de un plato</legend>
        <div className="r2-two">
          <Field label="Plato"><select value={compId} onChange={(e) => setCompId(e.target.value)}><option value="">Elegí un plato</option>{items.map((i) => <option key={i.id} value={i.id}>{i.qty}× {i.name}</option>)}</select></Field>
          <Field label="Motivo"><input value={compReason} maxLength={255} onChange={(e) => setCompReason(e.target.value)} /></Field>
          {!isBoss() && <Field label="PIN de un encargado"><input type="password" inputMode="numeric" maxLength={8} value={compPin} onChange={(e) => setCompPin(e.target.value)} /></Field>}
        </div>
        <button className="secondary-button" disabled={busy || !compId || !compReason.trim()} onClick={async () => { if (await adjust(`/items/${compId}/comp`, { reason: compReason, pin: compPin || null })) { setCompId(""); setCompReason(""); } }}>Dejar sin cargo</button>
      </fieldset>
      {order.cover_enabled && (
        <fieldset className="r2-fieldset">
          <legend>Cubierto</legend>
          <div className="r2-spread rs-spread"><span>{order.cover_removed ? "El cubierto está quitado de esta cuenta." : `Se cobra ${money(order.cover_amount)} por comensal${order.cover_text ? ` (${order.cover_text})` : ""}.`}</span>
            <button className="secondary-button" disabled={busy} onClick={() => adjust("/cover", { removed: !order.cover_removed })}>{order.cover_removed ? "Volver a cobrarlo" : "Quitar el cubierto"}</button></div>
        </fieldset>
      )}
    </div>
  );
}

function RefundDialog({ payment, onClose, onDone }: { payment: Payment; onClose: () => void; onDone: (o: OrderData | null) => void }) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  async function go() {
    try { const r = await appApi<{ order: OrderData | null; note: string }>(`/payments/${payment.id}/refund`, { method: "PATCH", body: { reason, pin: pin || null } }); onDone(r.order); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo devolver"); }
  }
  return (
    <Modal eyebrow="DEVOLUCIÓN" title={`Devolver ${money(payment.amount)} (${PAYMENT_METHODS[payment.method] || payment.method})`} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="rs-danger-button" onClick={go}>Devolver</button></>}>
      <div className="r2-dialog">
        <Field label="Motivo"><input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} /></Field>
        {!isBoss() && <Field label="PIN de un encargado"><input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} /></Field>}
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
