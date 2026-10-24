import { useState } from "react";
import { appApi, money, shortDate } from "../../config";
import { Field, Modal, Pill, strOrNull } from "../ui";
import { ConfirmModal, EmptyAction, fmtMoney, fmtNum } from "../r1/common";
import LinesEditor, { linesPayload } from "./LinesEditor";
import type { Line } from "./LinesEditor";
import PayModal from "./PayModal";
import { DOC_TYPES, METHODS } from "./types";
import type { Ing, Notify, Purchase, Supplier } from "./types";

export default function PurchasesTab({ purchases, suppliers, ings, reload, show, fail }: Notify & { purchases: Purchase[]; suppliers: Supplier[]; ings: Ing[]; reload: () => Promise<void> | void }) {
  const [filter, setFilter] = useState("PENDIENTE");
  const [sup, setSup] = useState("");
  const [open, setOpen] = useState<Purchase | "new" | null>(null);
  const list = purchases.filter((p) => (!filter || (filter === "VENCIDAS" ? p.overdue : p.status === filter)) && (!sup || p.supplier_id === Number(sup)));
  async function view(p: Purchase) { try { setOpen(await appApi<Purchase>(`/purchases/${p.id}`)); } catch (e) { fail(e); } }
  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-filters">
          <select aria-label="Estado" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="PENDIENTE">Con deuda</option><option value="VENCIDAS">Vencidas</option><option value="PAGA">Pagas</option><option value="">Todas</option></select>
          <select aria-label="Proveedor" value={sup} onChange={(e) => setSup(e.target.value)}><option value="">Todos los proveedores</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <button className="primary-button" disabled={!suppliers.length || !ings.length} onClick={() => setOpen("new")}>Cargar factura o remito</button>
      </div>
      {!suppliers.length || !ings.length ? <div className="rs-card"><EmptyAction title="Falta cargar datos" text="Para cargar una factura necesitás al menos un proveedor y un insumo." /></div>
        : !list.length ? <div className="rs-card"><EmptyAction title={filter === "PENDIENTE" ? "No le debés nada a nadie" : "No hay comprobantes con ese filtro"} text="Las facturas aparecen acá cuando recibís un pedido o las cargás a mano." /></div> : (
          <div className="rs-table-wrap"><table className="rs-table">
            <thead><tr><th>Comprobante</th><th>Proveedor</th><th>Vence</th><th className="num">Total</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id} className="is-click" onClick={() => view(p)}>
                <td><strong>{[p.doc_type || "Compra", p.doc_number].filter(Boolean).join(" ")}</strong><small>{shortDate(p.date)}</small></td><td>{p.supplier_name}</td>
                <td>{p.due_date ? shortDate(p.due_date) : "—"}</td><td className="num">{money(p.total)}</td><td className="num"><strong>{money(p.pending)}</strong></td>
                <td>{p.status === "PAGA" ? <Pill tone="green">Paga</Pill> : p.overdue ? <Pill tone="red">Vencida</Pill> : p.due_soon ? <Pill tone="orange">Vence pronto</Pill> : <Pill tone="blue">Pendiente</Pill>}</td>
              </tr>))}</tbody>
          </table></div>)}
      {open === "new" && <NewPurchase suppliers={suppliers} ings={ings} onClose={() => setOpen(null)} reload={reload} show={show} fail={fail} />}
      {open && open !== "new" && <PurchaseDetail purchase={open} onClose={() => setOpen(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

function NewPurchase({ suppliers, ings, onClose, reload, show, fail }: Notify & { suppliers: Supplier[]; ings: Ing[]; onClose: () => void; reload: () => Promise<void> | void }) {
  const [f, setF] = useState({ supplier: "", doc_type: "Factura A", doc_number: "", date: "", due_date: "", notes: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await appApi("/purchases", { method: "POST", body: { supplier_id: Number(f.supplier), doc_type: f.doc_type, doc_number: strOrNull(f.doc_number), date: f.date || null, due_date: f.due_date || null, notes: strOrNull(f.notes), items: linesPayload(lines) } });
      show("Compra cargada: el stock y la deuda ya están actualizados"); await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="COMPRA" title="Cargar factura o remito" size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" onClick={save} disabled={busy || !f.supplier || !linesPayload(lines).length}>{busy ? "Guardando..." : "Cargar compra"}</button></>}>
      <div className="r1-grid-form">
        <Field label="Proveedor"><select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })}><option value="">Elegí uno</option>{suppliers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Comprobante"><select value={f.doc_type} onChange={(e) => setF({ ...f, doc_type: e.target.value })}>{DOC_TYPES.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Número"><input value={f.doc_number} onChange={(e) => setF({ ...f, doc_number: e.target.value })} /></Field>
        <Field label="Fecha" hint="Vacío = hoy."><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Vence el pago" hint="Vacío = según la condición de pago del proveedor."><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label="Notas"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <h3 style={{ margin: "16px 0 8px", fontSize: 14, color: "var(--rs-ink)" }}>Qué compraste</h3>
      <LinesEditor lines={lines} onChange={setLines} ings={ings} />
      <p className="rs-muted" style={{ marginTop: 10 }}>Al cargarla entra la mercadería al stock y se actualiza el costo promedio de cada insumo.</p>
    </Modal>
  );
}

function PurchaseDetail({ purchase, onClose, reload, show, fail }: Notify & { purchase: Purchase; onClose: () => void; reload: () => Promise<void> | void }) {
  const [p, setP] = useState(purchase);
  const [pay, setPay] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function refresh() { setP(await appApi<Purchase>(`/purchases/${p.id}`)); await reload(); }
  async function void_() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/purchases/${p.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); setAsk(false); }
  }
  return (
    <Modal eyebrow="COMPRA" title={[p.doc_type || "Compra", p.doc_number].filter(Boolean).join(" ")} size="wide" onClose={onClose}
      footer={<>{!p.payments?.length && !p.order_id && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Anular</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>{p.status === "PENDIENTE" && <button className="primary-button" onClick={() => setPay(true)}>Registrar pago</button>}</>}>
      <div className="rs-row" style={{ marginBottom: 12 }}>
        <strong>{p.supplier_name}</strong><span className="rs-muted">{shortDate(p.date)}{p.due_date ? ` · vence ${shortDate(p.due_date)}` : ""}</span>
        {p.status === "PAGA" ? <Pill tone="green">Paga</Pill> : p.overdue ? <Pill tone="red">Vencida</Pill> : <Pill tone="blue">Pendiente</Pill>}
      </div>
      <div className="rs-table-wrap"><table className="rs-table">
        <thead><tr><th>Insumo</th><th className="num">Cantidad</th><th className="num">Costo unit.</th><th className="num">Subtotal</th></tr></thead>
        <tbody>{(p.items ?? []).map((i, n) => <tr key={n}><td>{i.ingredient_name}</td><td className="num">{fmtNum(i.qty, 3)} {i.unit}</td><td className="num">{fmtMoney(i.unit_cost)}</td><td className="num">{money(i.subtotal)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={3}>Total</td><td className="num">{money(p.total)}</td></tr></tfoot>
      </table></div>
      <div className="rs-grid-2" style={{ marginTop: 14, marginBottom: 0 }}>
        <div className="rs-kpi"><span>Pagado</span><strong>{money(p.paid)}</strong></div>
        <div className={`rs-kpi ${p.pending > 0 ? "is-warn" : ""}`}><span>Pendiente</span><strong>{money(p.pending)}</strong></div>
      </div>
      {!!p.payments?.length && <ul className="rs-list" style={{ marginTop: 10 }}>{p.payments.map((x) => <li key={x.id}><div className="rs-list-main"><strong>{METHODS.find((m) => m[0] === x.method)?.[1] ?? x.method}</strong><small>{shortDate(x.date)}</small></div><span className="rs-list-amount">{money(x.amount)}</span></li>)}</ul>}
      {pay && <PayModal title={`${p.supplier_name} · ${p.doc_number || "compra"}`} path={`/purchases/${p.id}/pay`} max={p.pending} onClose={() => setPay(false)} onDone={refresh} show={show} fail={fail} />}
      {ask && <ConfirmModal title="Anular la compra" confirmLabel="Anular" danger busy={busy} onClose={() => setAsk(false)} onConfirm={void_}>Se saca del stock lo que había entrado y se borra la deuda. Usalo solo si la cargaste por error.</ConfirmModal>}
    </Modal>
  );
}
