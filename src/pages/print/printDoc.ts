// Impresión desde el navegador (sin agente de impresión): ticket de 80 mm con CSS @page.
// Todo lo que sale de acá lleva «Documento no válido como factura».
import { dateTime, money } from "../../config";

export const NOT_INVOICE = "Documento no válido como factura";

export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Imprime un HTML en un marco oculto. `width`: ancho del papel. */
export function printHtml(title: string, bodyHtml: string, width = "80mm") {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: ${width} auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { margin: 0; width: ${width === "80mm" ? "72mm" : "auto"}; font: 12px/1.4 "Courier New", monospace; color: #000; background: #fff; }
    h1 { font-size: 15px; margin: 0 0 2px; text-align: center; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .big { font-size: 15px; font-weight: 700; }
    .warn { border: 1px solid #000; padding: 3px 5px; margin: 4px 0; font-weight: 700; }
    .legal { text-align: center; font-size: 11px; margin-top: 8px; }
  </style></head><body>${bodyHtml}</body></html>`);
  doc.close();
  win.onafterprint = () => window.setTimeout(() => frame.remove(), 300);
  window.setTimeout(() => { win.focus(); win.print(); window.setTimeout(() => frame.remove(), 60000); }, 150);
}

export interface RemitoData {
  number: number; kind: string; customer_name: string; phone: string | null; address: string | null; address_notes: string | null;
  zone_name: string | null; fee: number; total: number; paid: number; to_collect: number; notes: string | null;
  promised_at: string | null; courier_name: string | null; has_allergy: boolean;
  items?: { name: string; qty: number; line_total: number; notes: string | null; modifiers: string[] }[];
  venue?: { name: string | null; address: string | null; phone: string | null; footer: string | null };
}

/** Remito del pedido para el repartidor o para entregar con la comida (no es una factura) */
export function remitoHtml(d: RemitoData): string {
  const lines = (d.items || []).map((i) =>
    `<div class="row"><span>${esc(i.qty)}× ${esc(i.name)}</span><span>${esc(money(i.line_total))}</span></div>` +
    (i.modifiers.length ? `<div>&nbsp;&nbsp;+ ${esc(i.modifiers.join(", "))}</div>` : "") +
    (i.notes ? `<div>&nbsp;&nbsp;&gt; ${esc(i.notes)}</div>` : "")).join("");
  return `
    <h1>${esc(d.venue?.name || "Restidy")}</h1>
    ${d.venue?.address ? `<div class="c">${esc(d.venue.address)}</div>` : ""}
    ${d.venue?.phone ? `<div class="c">Tel. ${esc(d.venue.phone)}</div>` : ""}
    <div class="sep"></div>
    <div class="big c">Pedido #${String(d.number).padStart(3, "0")} · ${d.kind === "DELIVERY" ? "DELIVERY" : "TAKE-AWAY"}</div>
    ${d.promised_at ? `<div class="c">Prometido: ${esc(dateTime(d.promised_at))}</div>` : ""}
    <div class="sep"></div>
    <div class="b">${esc(d.customer_name)}</div>
    ${d.phone ? `<div>Tel. ${esc(d.phone)}</div>` : ""}
    ${d.kind === "DELIVERY" ? `<div>${esc(d.address || "")}${d.zone_name ? ` (${esc(d.zone_name)})` : ""}</div>${d.address_notes ? `<div>${esc(d.address_notes)}</div>` : ""}` : ""}
    ${d.courier_name ? `<div>Repartidor: ${esc(d.courier_name)}</div>` : ""}
    ${d.has_allergy ? `<div class="warn">ATENCIÓN: el cliente avisó una alergia o celiaquía. Revisá las notas.</div>` : ""}
    <div class="sep"></div>
    ${lines}
    ${d.fee ? `<div class="row"><span>Envío</span><span>${esc(money(d.fee))}</span></div>` : ""}
    <div class="sep"></div>
    <div class="row big"><span>Total</span><span>${esc(money(d.total))}</span></div>
    ${d.paid ? `<div class="row"><span>Ya pagado</span><span>${esc(money(d.paid))}</span></div>` : ""}
    <div class="row big"><span>A cobrar</span><span>${esc(money(d.to_collect))}</span></div>
    ${d.notes ? `<div class="sep"></div><div>Notas: ${esc(d.notes)}</div>` : ""}
    <div class="sep"></div>
    ${d.venue?.footer ? `<div class="c">${esc(d.venue.footer)}</div>` : ""}
    <div class="legal">${NOT_INVOICE}</div>`;
}
