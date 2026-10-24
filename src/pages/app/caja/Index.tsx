import { useCallback, useMemo, useState } from "react";
import "../../../r2.css";
import { PAYMENT_METHODS, appApi, dateTime, getSessionUser, hhmm, money } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, useFlash } from "../../../components/ui";
import CobroModal from "../../../components/caja/CobroModal";
import PrintPreview from "../../print/Ticket80";
import type { PrintDoc } from "../../print/Ticket80";
import { NETWORK_ERROR, usePoll } from "../../../components/salon/hooks";
import type { OrderData, ShiftData } from "../../../components/salon/types";

interface Register { id: number; name: string; open_shift_id: number | null }
interface Current { shift: ShiftData | null; stale: boolean; registers: Register[]; blind_cash_close: boolean; mp_webhook: boolean }
interface Bill { id: number; label: string; title: string; channel: string; status: string; waiter_name: string | null; total: number; paid: number; balance: number; fiscal_ref: string | null; methods: string[]; minutes: number; closed_at: string | null; unsent: number }
interface Hist { id: number; status: string; register_name: string; opened_by: string | null; opened_at: string; closed_at: string | null; sales_total: number; expected_cash: number | null; counted_cash: number | null; difference: number | null }

const DENOMS = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];
const num = (s: string) => { const n = Number(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

export default function CajaIndex() {
  const [tab, setTab] = useState<"turno" | "cuentas" | "historial">("turno");
  const [cur, setCur] = useState<Current | null>(null);
  const [error, setError] = useState("");
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [scope, setScope] = useState<"open" | "paid">("open");
  const [hist, setHist] = useState<Hist[] | null>(null);
  const [paying, setPaying] = useState<OrderData | null>(null);
  const [docs, setDocs] = useState<PrintDoc[]>([]);
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [detail, setDetail] = useState<ShiftData | null>(null);
  const [fiscalFor, setFiscalFor] = useState<Bill | null>(null);
  const [regId, setRegId] = useState("");
  const [float0, setFloat0] = useState("");
  const [busy, setBusy] = useState(false);
  const [closedResult, setClosedResult] = useState<ShiftData | null>(null);
  const { show, fail, node } = useFlash();
  const me = getSessionUser();
  const canHistory = me?.role !== "MOZO";

  const load = useCallback(() => {
    appApi<Current>("/cash/shifts/current").then((c) => { setCur(c); setError(""); }).catch((e) => { if (e instanceof Error && e.message !== NETWORK_ERROR) setError(e.message); });
    if (tab === "cuentas") appApi<Bill[]>(`/cash/orders?scope=${scope}`).then(setBills).catch(() => {});
    if (tab === "historial" && canHistory) appApi<Hist[]>("/cash/shifts?limit=30").then(setHist).catch(() => {});
  }, [tab, scope, canHistory]);
  usePoll(load, 6000, [tab, scope]);

  async function openShift() {
    setBusy(true);
    try {
      await appApi("/cash/shifts/open", { method: "POST", body: { register_id: regId ? Number(regId) : null, opening_float: num(float0) } });
      show("Caja abierta. Ya podés cobrar."); setFloat0(""); load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function openOrder(b: Bill): Promise<OrderData | null> {
    try { return await appApi<OrderData>(`/orders/${b.id}`); } catch (e) { fail(e); return null; }
  }
  const sync = (o: OrderData) => { setPaying((c) => (c && c.id === o.id ? o : c)); load(); };
  const s = cur?.shift || null;
  const byMethod = useMemo(() => Object.entries(s?.sales_by_method || {}), [s]);

  return (
    <div className="r2-page">
      <PageHeader eyebrow="SERVICIO" title="Caja" subtitle="Turno, cobros y cierre con arqueo.">
        {s && <button className="secondary-button" onClick={() => setMoving(true)}>Gasto o retiro</button>}
        {s && <button className="primary-button" onClick={() => setClosing(true)}>Cerrar turno</button>}
      </PageHeader>
      {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      <Tabs value={tab} onChange={setTab} options={[["turno", "Turno"], ["cuentas", "Cuentas"], ...(canHistory ? [["historial", "Historial"] as ["historial", string]] : [])]} />

      {tab === "turno" && (!cur && !error ? <Loading text="Cargando la caja..." /> : cur && !s ? (
        <div className="rs-card r2-pay">
          <div><h2>La caja está cerrada</h2><p className="r2-muted">Abrí el turno con el efectivo que dejás de fondo. Sin turno abierto no se puede cobrar.</p></div>
          {cur.registers.length === 0 ? <Empty title="No hay una caja configurada">Pedile al dueño que cree una en Configuración.</Empty> : (
            <>
              <div className="r2-two">
                {cur.registers.length > 1 && (
                  <Field label="Caja"><select value={regId} onChange={(e) => setRegId(e.target.value)}>
                    <option value="">{cur.registers[0].name}</option>
                    {cur.registers.map((r) => <option key={r.id} value={r.id} disabled={!!r.open_shift_id}>{r.name}{r.open_shift_id ? " (ya abierta)" : ""}</option>)}
                  </select></Field>
                )}
                <Field label="Fondo inicial (efectivo)"><input inputMode="decimal" value={float0} placeholder="0" onChange={(e) => setFloat0(e.target.value)} /></Field>
              </div>
              <div><button className="primary-button r2-btn-lg" disabled={busy} onClick={openShift}>Abrir caja</button></div>
            </>
          )}
        </div>
      ) : s && (
        <>
          {cur?.stale && <div className="rs-note rs-note-warn">Este turno se abrió antes de hoy. Cerralo y abrí uno nuevo para que las ventas queden en el día correcto.</div>}
          <div className="rs-kpis">
            <div className="rs-kpi"><span>Vendido en el turno</span><strong>{money(s.sales_total)}</strong><small>{s.orders_count} cuenta{s.orders_count === 1 ? "" : "s"} cobrada{s.orders_count === 1 ? "" : "s"}</small></div>
            <div className="rs-kpi"><span>Fondo inicial</span><strong>{money(s.opening_float)}</strong><small>{s.register_name} · {hhmm(s.opened_at)}</small></div>
            <div className="rs-kpi"><span>Propinas (aparte)</span><strong>{money(s.tips_total)}</strong></div>
            <div className="rs-kpi"><span>Efectivo en caja</span><strong>{s.expected_cash === null ? "Arqueo ciego" : money(s.expected_cash)}</strong><small>{s.expected_cash === null ? "Lo ves al cerrar, después de contar" : "Esperado"}</small></div>
            {s.pending_mp > 0 && <div className="rs-kpi is-warn"><span>Mercado Pago esperando</span><strong>{s.pending_mp}</strong></div>}
            {s.open_orders.length > 0 && <div className="rs-kpi is-warn"><span>Cuentas abiertas</span><strong>{s.open_orders.length}</strong></div>}
          </div>
          <div className="rs-grid-2">
            <div className="rs-card"><div className="rs-card-head"><div><h2>Ventas por medio</h2><p>Sin propinas.</p></div></div>
              {byMethod.length === 0 ? <div className="r2-muted">Todavía no hay cobros en este turno.</div> : (
                <div className="r2-paid-list">{byMethod.map(([m, v]) => <div key={m}><span>{PAYMENT_METHODS[m] || m}</span><span className="r2-money">{money(v)}</span></div>)}</div>)}
            </div>
            <div className="rs-card"><div className="rs-card-head"><div><h2>Movimientos de efectivo</h2><p>Ingresos, gastos y retiros.</p></div></div>
              {s.movements.length === 0 ? <div className="r2-muted">Sin movimientos.</div> : (
                <div className="r2-paid-list">{s.movements.map((m) => <div key={m.id}><span>{m.kind === "INGRESO" ? "Ingreso" : m.kind === "RETIRO" ? "Retiro" : "Gasto"}: {m.concept} · {hhmm(m.created_at)}</span><span className="r2-money">{m.kind === "INGRESO" ? "" : "−"}{money(m.amount)}</span></div>)}</div>)}
            </div>
          </div>
        </>
      ))}

      {tab === "cuentas" && (
        <>
          <div className="rs-seg"><button className={scope === "open" ? "is-on" : ""} onClick={() => { setScope("open"); setBills(null); }}>Por cobrar</button><button className={scope === "paid" ? "is-on" : ""} onClick={() => { setScope("paid"); setBills(null); }}>Cobradas hoy</button></div>
          {!s && scope === "open" && <div className="rs-note rs-note-warn">La caja está cerrada: abrí el turno para poder cobrar.</div>}
          {!bills ? <Loading /> : bills.length === 0 ? <Empty title={scope === "open" ? "No hay cuentas para cobrar" : "Todavía no se cobró nada hoy"}>{scope === "open" ? "Cuando una mesa pida la cuenta, aparece acá primero." : ""}</Empty> : (
            <div className="r2-bill-list">
              {bills.map((b) => (
                <div key={b.id} className={`r2-bill ${b.status === "CUENTA_PEDIDA" ? "is-ask" : ""}`}>
                  <div><strong>{b.title}</strong> <span className="r2-muted">{b.label}{b.waiter_name ? ` · ${b.waiter_name}` : ""}</span>
                    <div className="r2-btn-row">{b.status === "CUENTA_PEDIDA" && <Pill tone="orange">Pidió la cuenta · {b.minutes} min</Pill>}
                      {b.methods.map((m) => <Pill key={m}>{PAYMENT_METHODS[m] || m}</Pill>)}{b.fiscal_ref && <Pill tone="blue">{b.fiscal_ref}</Pill>}
                      {b.paid > 0 && b.balance > 0 && <Pill tone="orange">Cobrada en parte</Pill>}</div></div>
                  <div className="r2-bill-amount">{money(scope === "open" ? b.balance : b.total)}</div>
                  <div className="r2-bill-actions">
                    {scope === "open" && <button className="primary-button r2-btn-sm" disabled={!s} onClick={async () => { const o = await openOrder(b); if (o) setPaying(o); }}>Cobrar</button>}
                    {scope === "paid" && <button className="secondary-button r2-btn-sm" onClick={async () => { const o = await openOrder(b); if (o) setDocs([{ kind: "ticket", order: o }]); }}>Ticket</button>}
                    {scope === "paid" && <button className="secondary-button r2-btn-sm" onClick={() => setFiscalFor(b)}>Anotar comprobante</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "historial" && (!hist ? <Loading /> : hist.length === 0 ? <Empty title="Todavía no hay turnos">Los turnos cerrados quedan acá con su arqueo.</Empty> : (
        <div className="rs-table-wrap"><table className="rs-table"><thead><tr><th>Turno</th><th>Caja</th><th>Abrió</th><th>Vendido</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th /></tr></thead><tbody>
          {hist.map((h) => (
            <tr key={h.id}><td>#{h.id}</td><td>{h.register_name}</td><td>{h.opened_by} · {dateTime(h.opened_at)}</td><td>{money(h.sales_total)}</td>
              <td>{h.expected_cash === null ? "—" : money(h.expected_cash)}</td><td>{h.counted_cash === null ? "—" : money(h.counted_cash)}</td>
              <td>{h.difference === null ? <Pill tone="green">Abierto</Pill> : h.difference === 0 ? <Pill tone="green">Sin diferencia</Pill> : <Pill tone={h.difference < 0 ? "red" : "orange"}>{h.difference < 0 ? "Faltan" : "Sobran"} {money(Math.abs(h.difference))}</Pill>}</td>
              <td><button className="r2-mini" onClick={async () => { try { setDetail(await appApi<ShiftData>(`/cash/shifts/${h.id}/summary`)); } catch (e) { fail(e); } }}>Ver</button></td></tr>
          ))}</tbody></table></div>
      ))}

      {paying && <CobroModal order={paying} onClose={() => { setPaying(null); load(); }} onOrder={sync} onPrint={setDocs} onFail={fail} onOk={show} />}
      {moving && s && <MovementDialog onClose={() => setMoving(false)} onDone={() => { setMoving(false); show("Movimiento registrado"); load(); }} />}
      {closing && s && <CloseDialog shift={s} blind={!!cur?.blind_cash_close} onClose={() => setClosing(false)} onDone={(r) => { setClosing(false); setClosedResult(r); load(); }} />}
      {closedResult && <ShiftResult shift={closedResult} onClose={() => setClosedResult(null)} onPrint={() => setDocs([{ kind: "cierre", shift: closedResult, venueName: me?.company_name }])} />}
      {detail && <ShiftResult shift={detail} onClose={() => setDetail(null)} onPrint={() => setDocs([{ kind: "cierre", shift: detail, venueName: me?.company_name }])} />}
      {fiscalFor && <FiscalDialog bill={fiscalFor} onClose={() => setFiscalFor(null)} onDone={() => { setFiscalFor(null); show("Comprobante anotado"); load(); }} />}
      {docs.length > 0 && <PrintPreview doc={docs[0]} onClose={() => setDocs((d) => d.slice(1))} />}
      {node}
    </div>
  );
}

function MovementDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState("EGRESO");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  async function go() {
    if (concept.trim().length < 2 || num(amount) <= 0) { setError("Poné el concepto y el monto"); return; }
    try { await appApi("/cash/movements", { method: "POST", body: { kind, concept: concept.trim(), amount: num(amount) } }); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar"); }
  }
  return (
    <Modal eyebrow="CAJA" title="Gasto, retiro o ingreso" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={go}>Registrar</button></>}>
      <div className="r2-dialog">
        <div className="r2-chips" role="group" aria-label="Tipo">
          {([["EGRESO", "Gasto"], ["RETIRO", "Retiro del dueño"], ["INGRESO", "Ingreso"]] as const).map(([k, l]) => <button key={k} type="button" className={kind === k ? "is-on" : ""} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        <Field label="Concepto"><input value={concept} maxLength={150} onChange={(e) => setConcept(e.target.value)} placeholder="Hielo, verdulería, cambio…" /></Field>
        <Field label="Monto"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function CloseDialog({ shift, blind, onClose, onDone }: { shift: ShiftData; blind: boolean; onClose: () => void; onDone: (s: ShiftData) => void }) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [manual, setManual] = useState("");
  const [notes, setNotes] = useState("");
  const [transfer, setTransfer] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fromBills = DENOMS.reduce((t, d) => t + d * (Number(counts[d]) || 0), 0);
  const total = manual !== "" ? num(manual) : fromBills;
  async function go() {
    setBusy(true);
    try { onDone(await appApi<ShiftData>(`/cash/shifts/${shift.id}/close`, { method: "POST", body: { counted_cash: total, notes: notes.trim() || null, transfer_open: transfer } })); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cerrar"); setBusy(false); }
  }
  return (
    <Modal eyebrow="CIERRE DE TURNO" title="Contá el efectivo" size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Seguir trabajando</button><button className="primary-button" disabled={busy || (shift.open_orders.length > 0 && !transfer)} onClick={go}>Cerrar el turno</button></>}>
      <div className="r2-dialog">
        {shift.open_orders.length > 0 && (
          <div className="rs-note rs-note-warn">
            Quedan {shift.open_orders.length} cuenta(s) abiertas con cobros de este turno: {shift.open_orders.map((o) => o.title).join(", ")}. Cobralas antes de cerrar o pasalas al próximo turno.
            <label className="r2-check" style={{ marginTop: 8 }}><input type="checkbox" checked={transfer} onChange={(e) => setTransfer(e.target.checked)} /> Pasan al próximo turno</label>
          </div>
        )}
        <div className="rs-note rs-note-info">{blind ? "Arqueo ciego: contá primero y recién después te mostramos cuánto tenía que haber." : "Contá el efectivo y anotalo."} Las propinas en efectivo van aparte: contalas por separado si no las dejaste en la caja.</div>
        <div className="r2-bills-count">
          {DENOMS.map((d) => <label key={d}>{money(d)}<input inputMode="numeric" aria-label={`Billetes de ${d}`} value={counts[d] || ""} onChange={(e) => setCounts({ ...counts, [d]: e.target.value.replace(/\D/g, "") })} /></label>)}
        </div>
        <Field label="O ingresá el total contado" hint="Si lo completás, se usa este monto en lugar de la suma de billetes."><input inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} /></Field>
        <div className="r2-pay-total"><span>Efectivo contado</span><strong>{money(total)}</strong></div>
        <Field label="Notas del cierre (opcional)"><input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} /></Field>
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function ShiftResult({ shift, onClose, onPrint }: { shift: ShiftData; onClose: () => void; onPrint: () => void }) {
  const d = shift.difference;
  return (
    <Modal eyebrow={shift.status === "CERRADO" ? "TURNO CERRADO" : "TURNO"} title={`Turno #${shift.id} · ${shift.register_name || ""}`} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onPrint}>Imprimir cierre</button><button className="primary-button" onClick={onClose}>Listo</button></>}>
      <div className="r2-pay">
        {d !== null && <div className={`r2-diff ${d === 0 ? "is-ok" : d < 0 ? "is-bad" : "is-over"}`} role="status">{d === 0 ? "La caja cerró sin diferencia" : d < 0 ? `Faltan ${money(Math.abs(d))}` : `Sobran ${money(Math.abs(d))}`}</div>}
        <div className="r2-paid-list">
          <div><span>Fondo inicial</span><span>{money(shift.opening_float)}</span></div>
          {Object.entries(shift.sales_by_method).map(([m, v]) => <div key={m}><span>{PAYMENT_METHODS[m] || m}</span><span>{money(v)}</span></div>)}
          <div><strong>Total vendido</strong><strong>{money(shift.sales_total)}</strong></div>
          <div><span>Propinas (aparte)</span><span>{money(shift.tips_total)}</span></div>
          <div><span>Gastos y retiros</span><span>−{money(shift.expenses + shift.withdrawals)}</span></div>
          {shift.expected_cash !== null && <div><span>Efectivo esperado</span><span>{money(shift.expected_cash)}</span></div>}
          {shift.counted_cash !== null && <div><span>Efectivo contado</span><span>{money(shift.counted_cash)}</span></div>}
        </div>
        {shift.payments && shift.payments.length > 0 && (
          <details><summary>Cobros del turno ({shift.payments.length})</summary>
            <div className="r2-paid-list">{shift.payments.map((p) => <div key={p.id}><span>{p.title} · {PAYMENT_METHODS[p.method] || p.method}</span><span>{money(p.amount)}</span></div>)}</div></details>
        )}
      </div>
    </Modal>
  );
}

function FiscalDialog({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState(bill.fiscal_ref || "");
  const [error, setError] = useState("");
  async function go() { try { await appApi(`/orders/${bill.id}/fiscal-ref`, { method: "PATCH", body: { fiscal_ref: v.trim() || null } }); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } }
  return (
    <Modal eyebrow="COMPROBANTE" title={bill.title} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={go}>Guardar</button></>}>
      <div className="r2-dialog">
        <div className="rs-note rs-note-info">Restidy no emite facturas. Si emitiste una por afuera, anotá el tipo y número para tenerlo junto a la venta.</div>
        <Field label="Comprobante emitido afuera"><input value={v} maxLength={80} placeholder="Factura B 0001-00001234" onChange={(e) => setV(e.target.value)} /></Field>
        {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
