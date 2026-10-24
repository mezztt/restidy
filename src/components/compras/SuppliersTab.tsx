import { useCallback, useEffect, useState } from "react";
import { appApi, money, shortDate } from "../../config";
import { Field, Loading, Modal, Pill, Tabs, strOrNull } from "../ui";
import { ConfirmModal, EmptyAction, fmtMoney, fmtNum } from "../r1/common";
import PayModal from "./PayModal";
import type { AccountRow, Ing, Notify, PriceRow, Supplier } from "./types";

export default function SuppliersTab({ suppliers, ings, reload, show, fail }: Notify & { suppliers: Supplier[]; ings: Ing[]; reload: () => Promise<void> | void }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const list = suppliers.filter((s) => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <div className="rs-toolbar">
        <input className="rs-search" placeholder="Buscar proveedor..." aria-label="Buscar proveedor" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary-button" onClick={() => setEditing("new")}>Nuevo proveedor</button>
      </div>
      {!suppliers.length ? <div className="rs-card"><EmptyAction title="Todavía no cargaste proveedores" text="Cargá a quienes te venden mercadería para armar pedidos y llevar la cuenta corriente." action="Cargar el primero" onAction={() => setEditing("new")} /></div>
        : !list.length ? <div className="rs-card"><EmptyAction title="No hay proveedores con ese nombre" text="Probá con otra búsqueda." /></div> : (
          <div className="rs-table-wrap"><table className="rs-table">
            <thead><tr><th>Proveedor</th><th>Contacto</th><th>Condición</th><th className="num">Les debés</th><th>Estado</th></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.id} className="is-click" onClick={() => setEditing(s)}>
                <td><strong>{s.name}</strong>{s.cuit_text && <small>CUIT {s.cuit_text}</small>}</td>
                <td>{s.contact || "—"}<small>{s.phone}</small></td><td>{s.payment_terms || "—"}</td>
                <td className="num r1-sup-balance">{money(s.debt)}</td>
                <td>{s.overdue > 0 ? <Pill tone="red">Vencido {money(s.overdue)}</Pill> : s.due_soon > 0 ? <Pill tone="orange">Vence pronto</Pill> : s.debt > 0 ? <Pill tone="blue">Con deuda</Pill> : s.active ? <Pill tone="green">Al día</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
              </tr>))}</tbody>
          </table></div>)}
      {editing && <SupplierModal sup={editing === "new" ? null : editing} ings={ings} onClose={() => setEditing(null)} reload={reload} show={show} fail={fail} />}
    </>
  );
}

type Inner = "datos" | "insumos" | "precios" | "cuenta";

function SupplierModal({ sup, ings, onClose, reload, show, fail }: Notify & { sup: Supplier | null; ings: Ing[]; onClose: () => void; reload: () => Promise<void> | void }) {
  const [tab, setTab] = useState<Inner>("datos");
  const [cur, setCur] = useState<Supplier | null>(sup);
  const [f, setF] = useState({ name: sup?.name ?? "", cuit_text: sup?.cuit_text ?? "", phone: sup?.phone ?? "", email: sup?.email ?? "", contact: sup?.contact ?? "", payment_terms: sup?.payment_terms ?? "", notes: sup?.notes ?? "", active: sup?.active ?? true });
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const fetchOne = useCallback(async (id: number) => { setCur(await appApi<Supplier>(`/suppliers/${id}`)); }, []);
  useEffect(() => { if (sup) fetchOne(sup.id).catch(fail); }, [sup, fetchOne, fail]);

  async function save() {
    setBusy(true);
    try {
      const body = { name: f.name, cuit_text: strOrNull(f.cuit_text), phone: strOrNull(f.phone), email: strOrNull(f.email), contact: strOrNull(f.contact), payment_terms: strOrNull(f.payment_terms), notes: strOrNull(f.notes), active: f.active };
      const r = await appApi<Supplier>(cur ? `/suppliers/${cur.id}` : "/suppliers", { method: cur ? "PUT" : "POST", body });
      show("Proveedor guardado"); await reload();
      if (!cur) { setCur(r); setTab("insumos"); }
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { const r = await appApi<{ detail: string }>(`/suppliers/${cur!.id}`, { method: "DELETE" }); show(r.detail); await reload(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="PROVEEDOR" title={cur ? cur.name : "Nuevo proveedor"} size="wide" onClose={onClose}
      footer={<>{cur && <button className="rs-danger-button" style={{ marginRight: "auto" }} onClick={() => setAsk(true)}>Borrar</button>}
        <button className="secondary-button" onClick={onClose}>Cerrar</button>
        {tab === "datos" && <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar"}</button>}</>}>
      <div className="r1-tabs-inner"><Tabs value={tab} onChange={(t) => { if (cur || t === "datos") setTab(t); }} options={[["datos", "Datos"], ["insumos", "Qué nos vende"], ["precios", "Precios"], ["cuenta", "Cuenta corriente"]]} /></div>
      {tab === "datos" && (
        <div className="r1-grid-form">
          <Field label="Nombre"><input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="CUIT"><input value={f.cuit_text} onChange={(e) => set("cuit_text", e.target.value)} placeholder="30-12345678-9" /></Field>
          <Field label="Contacto"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
          <Field label="Teléfono / WhatsApp"><input inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+54 9 11 ..." /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Condición de pago" hint="«30 días» calcula solo el vencimiento de cada factura."><input value={f.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} placeholder="Contado, 15 días, 30 días..." /></Field>
          <Field label="Notas" wide><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <div className="rs-inline-checks" style={{ gridColumn: "1 / -1" }}><label><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Activo</label></div>
        </div>)}
      {tab === "insumos" && cur && <ItemsEditor sup={cur} ings={ings} refresh={() => fetchOne(cur.id)} show={show} fail={fail} />}
      {tab === "precios" && cur && <PricesView sup={cur} fail={fail} />}
      {tab === "cuenta" && cur && <AccountView sup={cur} refresh={async () => { await fetchOne(cur.id); await reload(); }} show={show} fail={fail} />}
      {ask && cur && <ConfirmModal title={`Borrar «${cur.name}»`} confirmLabel="Borrar" danger busy={busy} onClose={() => setAsk(false)} onConfirm={del}>Si tiene compras queda inactivo para no perder el historial.</ConfirmModal>}
    </Modal>
  );
}

function ItemsEditor({ sup, ings, refresh, show, fail }: Notify & { sup: Supplier; ings: Ing[]; refresh: () => Promise<void> }) {
  const [rows, setRows] = useState<{ ingredient_id: string; code: string; last_price: string }[]>((sup.items ?? []).map((i) => ({ ingredient_id: String(i.ingredient_id), code: i.code ?? "", last_price: String(i.last_price || "") })));
  const [busy, setBusy] = useState(false);
  const upd = (i: number, p: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  async function save() {
    setBusy(true);
    try {
      await appApi(`/suppliers/${sup.id}/items`, { method: "PUT", body: { items: rows.filter((r) => r.ingredient_id).map((r) => ({ ingredient_id: Number(r.ingredient_id), code: strOrNull(r.code), last_price: Number(r.last_price.replace(",", ".")) || 0 })) } });
      show("Lista guardada"); await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  return (
    <div className="rs-stack">
      <p className="rs-muted">Los insumos que le comprás, con su código y el último precio. Sirve para armar pedidos más rápido.</p>
      {rows.map((r, i) => {
        const g = ings.find((x) => x.id === Number(r.ingredient_id));
        return (
          <div key={i} className="r1-row-edit" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto" }}>
            <select aria-label="Insumo" value={r.ingredient_id} onChange={(e) => upd(i, { ingredient_id: e.target.value })}><option value="">Elegí un insumo</option>{ings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <input aria-label="Código del proveedor" placeholder="Código" value={r.code} onChange={(e) => upd(i, { code: e.target.value })} />
            <input aria-label={`Último precio por ${g?.unit ?? "unidad"}`} placeholder="Último precio" inputMode="decimal" value={r.last_price} onChange={(e) => upd(i, { last_price: e.target.value })} />
            <button className="rs-link rs-link-danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>Quitar</button>
          </div>);
      })}
      {!rows.length && <div className="rs-empty">Todavía no indicaste qué te vende.</div>}
      <div className="rs-row"><button className="secondary-button" onClick={() => setRows((x) => [...x, { ingredient_id: "", code: "", last_price: "" }])}>Agregar insumo</button><button className="primary-button" onClick={save} disabled={busy}>{busy ? "Guardando..." : "Guardar lista"}</button></div>
    </div>
  );
}

function PricesView({ sup, fail }: { sup: Supplier; fail: (e: unknown) => void }) {
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  useEffect(() => { appApi<PriceRow[]>(`/suppliers/${sup.id}/prices`).then(setRows).catch(fail); }, [sup.id, fail]);
  if (!rows) return <Loading />;
  if (!rows.length) return <div className="rs-empty">Todavía no le compraste nada. Cuando recibas pedidos o cargues facturas acá ves cómo cambia cada precio.</div>;
  return (
    <div className="rs-table-wrap"><table className="rs-table">
      <thead><tr><th>Fecha</th><th>Insumo</th><th className="num">Cantidad</th><th className="num">Costo unit.</th><th className="num">Variación</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}><td>{shortDate(r.date)}<small>{r.doc}</small></td><td>{r.ingredient_name}</td><td className="num">{fmtNum(r.qty, 3)} {r.unit}</td><td className="num">{fmtMoney(r.unit_cost)}</td>
          <td className="num" style={r.change_pct ? { color: r.change_pct > 0 ? "var(--rs-red-text)" : "var(--rs-green-text)", fontWeight: 800 } : undefined}>{r.change_pct == null ? "—" : `${r.change_pct > 0 ? "+" : ""}${fmtNum(r.change_pct, 1)}%`}</td></tr>))}</tbody>
    </table></div>
  );
}

function AccountView({ sup, refresh, show, fail }: Notify & { sup: Supplier; refresh: () => Promise<void> }) {
  const [data, setData] = useState<{ movements: AccountRow[]; balance: number } | null>(null);
  const [pay, setPay] = useState(false);
  const load = useCallback(() => appApi<{ movements: AccountRow[]; balance: number }>(`/suppliers/${sup.id}/account`).then(setData).catch(fail), [sup.id, fail]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Loading />;
  return (
    <div className="rs-stack">
      <div className="rs-row" style={{ justifyContent: "space-between" }}>
        <div><span className="rs-muted">Saldo que les debés</span><div style={{ fontSize: 26, fontWeight: 800, color: "var(--rs-ink)" }}>{money(data.balance)}</div></div>
        {data.balance > 0 && <button className="primary-button" onClick={() => setPay(true)}>Pagar a cuenta</button>}
      </div>
      {!data.movements.length ? <div className="rs-empty">Sin movimientos todavía.</div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Fecha</th><th>Detalle</th><th className="num">Compra</th><th className="num">Pago</th><th className="num">Saldo</th></tr></thead>
          <tbody>{data.movements.map((m, i) => (
            <tr key={i}><td>{shortDate(m.date)}</td><td>{m.label}</td><td className="num">{m.kind === "CARGO" ? money(m.amount) : ""}</td><td className="num">{m.kind === "PAGO" ? money(m.amount) : ""}</td><td className="num"><strong>{money(m.balance)}</strong></td></tr>))}</tbody>
        </table></div>)}
      {pay && <PayModal title={sup.name} path={`/suppliers/${sup.id}/pay`} max={data.balance} onClose={() => setPay(false)} onDone={async () => { await load(); await refresh(); }} show={show} fail={fail} />}
    </div>
  );
}
