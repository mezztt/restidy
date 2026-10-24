import { useEffect } from "react";
import { PAYMENT_METHODS, dateTime, hhmm, money } from "../../config";
import type { KdsTicket, OrderData, ShiftData } from "../../components/salon/types";

/**
 * Impresión de 80 mm desde el navegador (CSS @page): comanda de cocina, precuenta, ticket de venta y cierre de turno.
 * Todo lo que parece una factura lleva «Documento no válido como factura»: Restidy no emite comprobantes fiscales.
 */
export type PrintDoc =
  | { kind: "comanda"; ticket: KdsTicket }
  | { kind: "precuenta"; order: OrderData }
  | { kind: "ticket"; order: OrderData }
  | { kind: "cierre"; shift: ShiftData; venueName?: string | null };

export const NOT_INVOICE = "Documento no válido como factura";

function Line({ left, right, strong }: { left: string; right?: string; strong?: boolean }) {
  return <div className={`r2-line ${strong ? "is-strong" : ""}`}><span>{left}</span>{right !== undefined && <span>{right}</span>}</div>;
}

function Rule() { return <div className="r2-rule" aria-hidden="true" />; }

function qtyText(q: number): string { return Number.isInteger(q) ? String(q) : String(q).replace(".", ","); }

function ComandaSheet({ t }: { t: KdsTicket }) {
  const items = t.items.filter((i) => i.status !== "ANULADO");
  return (
    <>
      <div className="r2-sheet-title">COMANDA · {(t.station_name || "Cocina").toUpperCase()}</div>
      <div className="r2-sheet-big">{t.table_name ? `Mesa ${t.table_name}` : t.title}</div>
      <Line left={`Pedido ${t.order_label}`} right={`Comanda N° ${t.number}`} />
      <Line left={t.waiter_name ? `Mozo: ${t.waiter_name}` : t.customer_name ? `A nombre de: ${t.customer_name}` : " "} right={hhmm(t.sent_at)} />
      <Rule />
      {t.has_allergy && <div className="r2-sheet-alert">*** ALERGIA / CELÍACO ***</div>}
      {items.map((i) => (
        <div key={i.id} className="r2-sheet-item">
          <div className="r2-sheet-item-main"><b>{qtyText(i.qty)} x</b> {i.name}{i.course > 1 ? <em> · Tiempo {i.course}</em> : null}</div>
          {i.modifiers.map((m, k) => <div key={k} className="r2-sheet-sub">+ {m.name}</div>)}
          {i.notes && <div className="r2-sheet-note">» {i.notes}</div>}
          {i.allergy_alert && <div className="r2-sheet-alert is-inline">¡ALERGIA!</div>}
        </div>
      ))}
      <Rule />
      {t.notes && <div className="r2-sheet-note">Mesa: {t.notes}</div>}
    </>
  );
}

function OrderSheet({ o, mode }: { o: OrderData; mode: "precuenta" | "ticket" }) {
  const items = o.items.filter((i) => i.status !== "ANULADO" && i.status !== "POR_CONFIRMAR");
  const payments = o.payments.filter((p) => p.status === "APROBADO");
  const tips = payments.reduce((s, p) => s + p.tip_amount, 0);
  const changeGiven = payments.reduce((s, p) => s + p.change_given, 0);
  const tipPct = o.settings.tip_default_pct;
  return (
    <>
      {o.venue.name && <div className="r2-sheet-name">{o.venue.name}</div>}
      {o.venue.address && <div className="r2-sheet-center">{o.venue.address}</div>}
      {(o.venue.phone || o.venue.cuit_text) && <div className="r2-sheet-center">{[o.venue.phone && `Tel. ${o.venue.phone}`, o.venue.cuit_text && `CUIT ${o.venue.cuit_text}`].filter(Boolean).join(" · ")}</div>}
      <Rule />
      <div className="r2-sheet-title">{mode === "precuenta" ? "PRECUENTA" : "TICKET DE VENTA"}</div>
      {o.channel === "MOSTRADOR" && <div className="r2-sheet-big">Retiro {o.label}{o.customer_name ? ` · ${o.customer_name}` : ""}</div>}
      {o.channel !== "MOSTRADOR" && <div className="r2-sheet-big">{o.title}</div>}
      <Line left={`Pedido ${o.label}`} right={dateTime(o.closed_at || new Date().toISOString())} />
      {o.waiter_name && <Line left={`Atendió: ${o.waiter_name}`} right={o.channel === "SALON" ? `${o.covers} comensal${o.covers === 1 ? "" : "es"}` : ""} />}
      <Rule />
      {items.map((i) => (
        <div key={i.id} className="r2-sheet-item">
          <Line left={`${qtyText(i.qty)} x ${i.name}`} right={i.comped ? "Cortesía" : money(i.line_total)} />
          {i.modifiers.map((m, k) => <div key={k} className="r2-sheet-sub">+ {m.name}{m.price_delta ? ` (${money(m.price_delta)})` : ""}</div>)}
        </div>
      ))}
      <Rule />
      <Line left="Subtotal" right={money(o.subtotal)} />
      {o.discount_total > 0 && <Line left="Descuentos" right={`-${money(o.discount_total)}`} />}
      {o.cover_charge > 0 && <Line left={`Cubierto${o.cover_text ? ` (${o.cover_text})` : ""}`} right={money(o.cover_charge)} />}
      {o.delivery_fee > 0 && <Line left="Envío" right={money(o.delivery_fee)} />}
      <Line left="TOTAL" right={money(o.total)} strong />
      {mode === "ticket" && payments.length > 0 && (
        <>
          <Rule />
          {payments.map((p) => <Line key={p.id} left={`${PAYMENT_METHODS[p.method] || p.method}${p.split_label ? ` · ${p.split_label}` : ""}`} right={money(p.amount)} />)}
          {changeGiven > 0 && <Line left="Vuelto" right={money(changeGiven)} />}
          {tips > 0 && <Line left="Propina (voluntaria, no está en el total)" right={money(tips)} />}
        </>
      )}
      {mode === "precuenta" && o.settings.tip_enabled && (
        <>
          <Rule />
          <div className="r2-sheet-note">Propina voluntaria, no incluida en el total. Sugerida {tipPct}%: {money(o.suggested_tip)}. Podés dejar más, menos o nada.</div>
        </>
      )}
      {o.fiscal_ref && <div className="r2-sheet-center">Comprobante emitido aparte: {o.fiscal_ref}</div>}
      <Rule />
      <div className="r2-sheet-legal">{NOT_INVOICE.toUpperCase()}</div>
      {o.venue.footer && <div className="r2-sheet-center">{o.venue.footer}</div>}
      <div className="r2-sheet-center">Gracias por tu visita</div>
    </>
  );
}

function ShiftSheet({ s, venueName }: { s: ShiftData; venueName?: string | null }) {
  const diff = s.difference;
  return (
    <>
      {venueName && <div className="r2-sheet-name">{venueName}</div>}
      <div className="r2-sheet-title">CIERRE DE TURNO N° {s.id}</div>
      <Line left="Caja" right={s.register_name || ""} />
      <Line left="Abrió" right={`${s.opened_by || ""} · ${dateTime(s.opened_at)}`} />
      {s.closed_at && <Line left="Cerró" right={`${s.closed_by || ""} · ${dateTime(s.closed_at)}`} />}
      <Rule />
      <Line left="Fondo inicial" right={money(s.opening_float)} />
      <div className="r2-sheet-sub-title">Ventas (sin propinas)</div>
      {Object.entries(s.sales_by_method).map(([m, v]) => <Line key={m} left={PAYMENT_METHODS[m] || m} right={money(v)} />)}
      <Line left="Total vendido" right={money(s.sales_total)} strong />
      <Line left="Cuentas cobradas" right={String(s.orders_count)} />
      <Rule />
      <Line left="Propinas (aparte)" right={money(s.tips_total)} />
      <Line left="Ingresos" right={money(s.incomes)} />
      <Line left="Gastos" right={`-${money(s.expenses)}`} />
      <Line left="Retiros" right={`-${money(s.withdrawals)}`} />
      <Rule />
      {s.expected_cash !== null && <Line left="Efectivo esperado" right={money(s.expected_cash)} />}
      {s.counted_cash !== null && <Line left="Efectivo contado" right={money(s.counted_cash)} />}
      {diff !== null && <Line left={diff === 0 ? "Sin diferencia" : diff < 0 ? "Faltante" : "Sobrante"} right={money(Math.abs(diff))} strong />}
      {s.notes && <div className="r2-sheet-note">Notas: {s.notes}</div>}
      <Rule />
      <div className="r2-sheet-legal">{NOT_INVOICE.toUpperCase()}</div>
    </>
  );
}

const TITLES: Record<PrintDoc["kind"], string> = {
  comanda: "Comanda de cocina", precuenta: "Precuenta", ticket: "Ticket de venta", cierre: "Cierre de turno",
};

/** Vista previa del papel de 80 mm y botón para imprimir. Mientras está abierta, el resto de la pantalla no sale en la impresión. */
export default function PrintPreview({ doc, onClose }: { doc: PrintDoc; onClose: () => void }) {
  useEffect(() => {
    document.body.classList.add("r2-printing");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("r2-printing"); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div className="modal-overlay r2-print-overlay" onMouseDown={onClose}>
      <div className="product-modal r2-print-modal" role="dialog" aria-modal="true" aria-label={`Vista previa: ${TITLES[doc.kind]}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="dashboard-eyebrow">VISTA PREVIA · PAPEL DE 80 MM</span>
            <h2>{TITLES[doc.kind]}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p className="rs-muted r2-print-help">Se imprime desde el navegador: elegí tu impresora térmica y tamaño «80 mm» (o «Guardar como PDF»).</p>
        <div className="r2-sheet-wrap">
          <div className="r2-sheet" data-contrast-ignore>
            {doc.kind === "comanda" && <ComandaSheet t={doc.ticket} />}
            {doc.kind === "precuenta" && <OrderSheet o={doc.order} mode="precuenta" />}
            {doc.kind === "ticket" && <OrderSheet o={doc.order} mode="ticket" />}
            {doc.kind === "cierre" && <ShiftSheet s={doc.shift} venueName={doc.venueName} />}
          </div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cerrar</button>
          <button className="primary-button" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>
    </div>
  );
}
