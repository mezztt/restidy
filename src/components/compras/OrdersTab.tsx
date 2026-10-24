import { useState } from "react";
import { appApi, money, shortDate } from "../../config";
import { Field, Modal, Pill, numOrNull, strOrNull } from "../ui";
import { ConfirmModal, EmptyAction, fmtNum, QtyInput } from "../r1/common";
import LinesEditor, { linesPayload, newLine } from "./LinesEditor";
import type { Line } from "./LinesEditor";
import { DOC_TYPES, ORDER_LABEL } from "./types";
import type { Ing, Notify, Order, Supplier } from "./types";

export default function OrdersTab({ orders, suppliers, ings, reload, show, fail }: Notify & { orders: Order[]; suppliers: Supplier[]; ings: Ing[]; reload: () => Promise<void> | void }) {
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Order | "new" | null>(null);
  const list = orders.filter((o) => !status || o.status === status);
  async function open(o: Order) { try { setEditing(await appApi<Order>(`/purchase-orders/${o.id}`)); } catch (e) { fail(e); } }
  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-filters"><select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los pedidos</option>{Object.entries(ORDER_LABEL).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <button className="primary-button" disabled={!suppliers.length} onClick={() => setEditing("new")}>Nuevo pedido</button>
      </div>
      {!suppliers.length ? <div className="rs-card"><EmptyAction title="Primero cargá un proveedor" text="Los pedidos se arman a un proveedor. Cargalo en la pestaña Proveedores." /></div>
        : !list.length ? <div className="rs-card"><EmptyAction title="No hay pedidos" text="Armá un pedido, enviáselo al proveedor y cuando llegue la mercadería registrá la recepción con el costo real." action="Nuevo pedido" onAction={() => setEditing("new")} /></div> : (
          <div className="rs-table-wrap"><table className="rs-table">
            <thead><tr><th>Pedido</th><th>Proveedor</th><th>Esperado</th><th className="num">Renglones</th><th className="num">Total estimado</th><th>Estado</th></tr></thead>
            <tbody>{list.map((o) => (
              <tr key={o.id} className="is-click" onClick={() => open(o)}>
                <td><strong>#{o.id}</strong><small>{shortDate(o.created_at)}</small></td><td>{o.supplier_name}</td><td>{o.expected_date ? shortDate(o.expected_date) : "—"}</td>
                <td className="num">{o.items_count}</td><td className="num">{money(o.total)}</td><td><Pill tone={ORDER_LABEL[o.status][0]}>{ORDER_LABEL[o.status][1]}</Pill></td>
              </tr>))}</tbody>
          </table></div>)}
      {editing && <OrderModal order={editing === "new" ? null : editing} suppliers={suppliers} ings={ings} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function waText(o: { supplier_name?: string | null; expected_date: string | null; notes: string | null }, lines: { name: string; qty: number; unit: string }[], business: string) {
  const body = lines.map((l) => `- ${l.name}: ${fmtNum(l.qty, 3)} ${l.unit}`).join("\n");
  return `Hola${o.supplier_name ? " " + o.supplier_name : ""}! Te paso el pedido de ${business}:\n${body}${o.expected_date ? `\nLo necesitamos para el ${shortDate(o.expected_date)}.` : ""}${o.notes ? `\n${o.notes}` : ""}\nGracias!`;
}

function OrderModal({ order, suppliers, ings, onClose, reload, show, fail }: Notify & { order: Order | null; suppliers: Supplier[]; ings: Ing[]; onClose: () => void; reload: () => Promise<void> | void }) {
  const [cur, setCur] = useState<Order | null>(order);
  const locked = !!cur && !["BORRADOR", "ENVIADA"].includes(cur.status) || (!!cur && cur.status === "ENVIADA" && (cur.items ?? []).some((i) => i.received_qty > 0));
  const [supplier, setSupplier] = useState(order ? String(order.supplier_id) : "");
  const [date, setDate] = useState(order?.expected_date ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [lines, setLines] = useState<Line[]>((order?.items ?? []).map((i, n) => ({ key: `o${n}`, ingredient_id: String(i.ingredient_id), qty: i.qty, unit_cost: i.unit_cost ? String(i.unit_cost) : "" })));
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<"cancel" | "delete" | null>(null);
  const [receive, setReceive] = useState(false);
  const sup = suppliers.find((s) => s.id === Number(supplier));

  async function save(): Promise<Order | null> {
    setBusy(true);
    try {
      const o = await appApi<Order>(cur ? `/purchase-orders/${cur.id}` : "/purchase-orders", { method: cur ? "PUT" : "POST", body: { supplier_id: Number(supplier), expected_date: date || null, notes: strOrNull(notes), items: linesPayload(lines) } });
      setCur(o); setLines((o.items ?? []).map((i, n) => ({ key: `o${n}`, ingredient_id: String(i.ingredient_id), qty: i.qty, unit_cost: i.unit_cost ? String(i.unit_cost) : "" })));
      await reload(); return o;
    } catch (e) { fail(e); return null; } finally { setBusy(false); }
  }
  async function act(path: string, ok: string, method = "POST") {
    if (!cur) return;
    setBusy(true);
    try { await appApi(`/purchase-orders/${cur.id}${path}`, { method }); show(ok); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); setAsk(null); }
  }
  async function suggest() {
    try {
      const a = await appApi<Ing[]>("/stock/alerts");
      const mine = a.filter((x) => (!supplier || !x.default_supplier_id || x.default_supplier_id === Number(supplier)) && !lines.some((l) => Number(l.ingredient_id) === x.id));
      if (!mine.length) return show("No hay faltantes para este proveedor");
      setLines((l) => [...l.filter((x) => x.ingredient_id), ...mine.map((x, n) => ({ ...newLine(n), ingredient_id: String(x.id), qty: x.missing || x.min_qty || 1, unit_cost: x.cost_last ? String(x.cost_last) : "" }))]);
      show(`${mine.length} insumos bajo el mínimo agregados`);
    } catch (e) { fail(e); }
  }
  async function send() {
    const o = cur?.status === "BORRADOR" || !cur ? await save() : cur;
    if (!o) return;
    if (o.status === "BORRADOR") { try { await appApi(`/purchase-orders/${o.id}/send`, { method: "POST" }); show("Pedido marcado como enviado"); await reload(); onClose(); } catch (e) { fail(e); } }
  }
  const rows = lines.filter((l) => l.ingredient_id && l.qty).map((l) => { const g = ings.find((x) => x.id === Number(l.ingredient_id))!; return { name: g?.name ?? "", qty: l.qty as number, unit: g?.unit ?? "" }; });
  const text = waText({ supplier_name: sup?.contact || sup?.name, expected_date: date || null, notes: notes || null }, rows, "nuestro local");
  const phone = (sup?.phone || "").replace(/\D/g, "");
  const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : "";

  return (
    <Modal eyebrow="PEDIDO A PROVEEDOR" title={cur ? `Pedido #${cur.id}` : "Nuevo pedido"} size="wide" onClose={onClose}
      footer={<>
        {cur && cur.status === "BORRADOR" && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk("delete")}>Borrar</button>}
        {cur && ["ENVIADA", "PARCIAL"].includes(cur.status) && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk("cancel")}>Cancelar pedido</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        {!locked && <button className="secondary-button" onClick={async () => { if (await save()) show("Pedido guardado"); }} disabled={busy || !supplier}>Guardar</button>}
        {(!cur || cur.status === "BORRADOR") && <button className="primary-button" onClick={send} disabled={busy || !supplier || !linesPayload(lines).length}>Guardar y marcar enviado</button>}
        {cur && ["ENVIADA", "PARCIAL"].includes(cur.status) && <button className="primary-button" onClick={() => setReceive(true)}>Recibir mercadería</button>}
      </>}>
      {cur && <div className="rs-row" style={{ marginBottom: 12 }}><Pill tone={ORDER_LABEL[cur.status][0]}>{ORDER_LABEL[cur.status][1]}</Pill>{cur.status === "PARCIAL" && <span className="rs-muted">Falta recibir una parte.</span>}</div>}
      <div className="r1-grid-form">
        <Field label="Proveedor"><select value={supplier} disabled={locked || (!!cur && cur.status !== "BORRADOR")} onChange={(e) => setSupplier(e.target.value)}><option value="">Elegí uno</option>{suppliers.filter((s) => s.active || s.id === Number(supplier)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Lo necesito para el"><input type="date" disabled={locked} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Notas para el proveedor" wide><input disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <h3 style={{ margin: "16px 0 8px", fontSize: 14, color: "var(--rs-ink)" }}>Qué pedís</h3>
      {locked && cur?.items ? (
        <div className="rs-table-wrap"><table className="rs-table"><thead><tr><th>Insumo</th><th className="num">Pedido</th><th className="num">Recibido</th><th className="num">Costo</th></tr></thead>
          <tbody>{cur.items.map((i) => <tr key={i.id}><td>{i.ingredient_name}</td><td className="num">{fmtNum(i.qty, 3)} {i.unit}</td><td className="num">{fmtNum(i.received_qty, 3)}</td><td className="num">{money(i.unit_cost)}</td></tr>)}</tbody></table></div>
      ) : (
        <>
          <LinesEditor lines={lines} onChange={setLines} ings={ings} />
          <div style={{ marginTop: 8 }}><button className="secondary-button" onClick={suggest}>Agregar lo que falta (bajo el mínimo)</button></div>
        </>)}
      {cur && cur.status !== "CANCELADA" && rows.length > 0 && (
        <div className="rs-note rs-note-info" style={{ marginTop: 14 }}>
          <strong>Enviarlo:</strong> el sistema no manda mensajes por su cuenta. Copiá el texto o abrí WhatsApp con el pedido ya escrito.
          <div className="rs-row" style={{ marginTop: 8 }}>
            <button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(text).then(() => show("Texto copiado"), () => show("No se pudo copiar", true)); }}>Copiar texto</button>
            {wa ? <a className="secondary-button" href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: "none", padding: "10px 16px", borderRadius: 12 }}>Abrir WhatsApp</a> : <span className="rs-muted">Cargá el teléfono del proveedor para abrir WhatsApp.</span>}
          </div>
        </div>)}
      {ask === "cancel" && <ConfirmModal title="Cancelar el pedido" confirmLabel="Cancelar pedido" danger busy={busy} onClose={() => setAsk(null)} onConfirm={() => act("/cancel", "Pedido cancelado")}>Lo que ya recibiste queda cargado. Lo que falta no se espera más.</ConfirmModal>}
      {ask === "delete" && <ConfirmModal title="Borrar el borrador" confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(null)} onConfirm={() => act("", "Pedido borrado", "DELETE")}>Se borra por completo.</ConfirmModal>}
      {receive && cur && <ReceiveModal order={cur} onClose={() => setReceive(false)} onDone={async () => { await reload(); onClose(); }} show={show} fail={fail} />}
    </Modal>
  );
}

function ReceiveModal({ order, onClose, onDone, show, fail }: Notify & { order: Order; onClose: () => void; onDone: () => Promise<void> }) {
  const items = (order.items ?? []).filter((i) => i.pending_qty > 0);
  const [qty, setQty] = useState<Record<number, number | null>>(() => Object.fromEntries(items.map((i) => [i.id!, i.pending_qty])));
  const [cost, setCost] = useState<Record<number, string>>(() => Object.fromEntries(items.map((i) => [i.id!, i.unit_cost ? String(i.unit_cost) : ""])));
  const [docType, setDocType] = useState("Remito");
  const [docNum, setDocNum] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + (qty[i.id!] || 0) * (numOrNull(cost[i.id!]) || 0), 0);
  async function go() {
    setBusy(true);
    try {
      await appApi(`/purchase-orders/${order.id}/receive`, { method: "POST", body: { items: items.map((i) => ({ item_id: i.id, qty: qty[i.id!] || 0, unit_cost: numOrNull(cost[i.id!]) })), doc_type: docType, doc_number: strOrNull(docNum), due_date: due || null } });
      show("Recepción registrada: el stock y el costo ya están actualizados"); await onDone();
    } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="RECEPCIÓN" title={`Pedido #${order.id} · ${order.supplier_name}`} size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" onClick={go} disabled={busy || !items.some((i) => qty[i.id!])}>{busy ? "Registrando..." : "Confirmar recepción"}</button></>}>
      <p className="rs-muted">Cargá lo que llegó de verdad y a qué precio. Lo que no llegó dejalo en 0: sigue pendiente. Esto suma al stock, recalcula el costo promedio y genera la deuda con el proveedor.</p>
      <div className="rs-stack">
        {items.map((i) => (
          <div key={i.id} className="r1-row-edit" style={{ gridTemplateColumns: "minmax(0,2fr) auto minmax(0,110px)" }}>
            <div><strong>{i.ingredient_name}</strong><small className="rs-hint" style={{ marginTop: 0 }}>Faltan {fmtNum(i.pending_qty, 3)} {i.unit}</small></div>
            <QtyInput value={qty[i.id!]} unit={i.unit} onChange={(v) => setQty((x) => ({ ...x, [i.id!]: v }))} ariaLabel={`Recibido de ${i.ingredient_name}`} />
            <input aria-label={`Costo por ${i.unit}`} placeholder={`$ por ${i.unit}`} inputMode="decimal" value={cost[i.id!]} onChange={(e) => setCost((x) => ({ ...x, [i.id!]: e.target.value }))} />
          </div>))}
      </div>
      <div className="r1-grid-form" style={{ marginTop: 14 }}>
        <Field label="Comprobante"><select value={docType} onChange={(e) => setDocType(e.target.value)}>{DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Número"><input value={docNum} onChange={(e) => setDocNum(e.target.value)} placeholder="0001-00001234" /></Field>
        <Field label="Vence el pago" hint="Vacío = según la condición de pago del proveedor."><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <div style={{ alignSelf: "end", textAlign: "right" }}><span className="rs-muted">Total a deber</span><div style={{ fontSize: 22, fontWeight: 800, color: "var(--rs-ink)" }}>{money(total)}</div></div>
      </div>
    </Modal>
  );
}
