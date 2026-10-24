import { useCallback, useEffect, useMemo, useState } from "react";
import "../../../r2.css";
import { appApi, getSessionUser } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Seg, useFlash } from "../../../components/ui";
import Plano from "../../../components/salon/Plano";
import type { PlanTable } from "../../../components/salon/Plano";
import Workspace from "../../../components/salon/Workspace";
import EightySix from "../../../components/salon/EightySix";
import CobroModal from "../../../components/caja/CobroModal";
import PrintPreview from "../../print/Ticket80";
import type { PrintDoc } from "../../print/Ticket80";
import { NETWORK_ERROR, useOnline, usePoll } from "../../../components/salon/hooks";
import type { OrderData } from "../../../components/salon/types";

interface TablesData { areas: { id: number; name: string }[]; tables: PlanTable[]; summary: { free: number; occupied: number; covers: number } }
interface Call { id: number; table_id: number; table_name: string; kind: string; minutes: number; order_id: number | null; mine: boolean }

export default function SalonIndex() {
  const [data, setData] = useState<TablesData | null>(null);
  const [error, setError] = useState("");
  const [area, setArea] = useState<number | "all">("all");
  // en celular el plano a escala queda ilegible: arranca en lista
  const [mode, setMode] = useState<"plano" | "lista">(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches ? "lista" : "plano"));
  const [onlyMine, setOnlyMine] = useState(false);
  const [calls, setCalls] = useState<Call[]>([]);
  const [waiters, setWaiters] = useState<{ id: number; name: string }[]>([]);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [opening, setOpening] = useState<PlanTable | null>(null);
  const [covers, setCovers] = useState("2");
  const [paying, setPaying] = useState<OrderData | null>(null);
  const [docs, setDocs] = useState<PrintDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [eighty, setEighty] = useState(false);
  const online = useOnline();
  const { show, fail, node } = useFlash();
  const me = getSessionUser();

  const load = useCallback(() => {
    appApi<TablesData>("/salon/tables").then((d) => { setData(d); setError(""); }).catch((e) => { if (e instanceof Error && e.message !== NETWORK_ERROR) setError(e.message); });
    appApi<Call[]>("/service-calls").then(setCalls).catch(() => {});
  }, []);
  usePoll(load, 5000);
  useEffect(() => { appApi<{ id: number; name: string }[]>("/salon/waiters").then(setWaiters).catch(() => {}); }, []);

  const onOrder = useCallback((o: OrderData) => {
    setOrder((cur) => (cur && cur.id === o.id ? o : cur));
    setPaying((cur) => (cur && cur.id === o.id ? o : cur));
    load();
  }, [load]);

  async function openTable(t: PlanTable) {
    if (t.order_id) {
      try { setOrder(await appApi<OrderData>(`/orders/${t.order_id}`)); } catch (e) { fail(e); }
    } else { setCovers(String(Math.min(t.seats, 2) || 2)); setOpening(t); }
  }
  async function confirmOpen() {
    if (!opening) return;
    setBusy(true);
    try {
      const o = await appApi<OrderData>("/orders", { method: "POST", body: { channel: "SALON", table_id: opening.id, covers: Math.max(1, Number(covers) || 1) } });
      setOpening(null); setOrder(o); load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function attend(c: Call) {
    try { await appApi(`/service-calls/${c.id}`, { method: "PATCH", body: { status: "ATENDIDO" } }); load(); } catch (e) { fail(e); }
  }

  const tables = useMemo(() => (data?.tables || []).filter((t) => (area === "all" || t.area_id === area) && (!onlyMine || t.mine)), [data, area, onlyMine]);
  const free = useMemo(() => (data?.tables || []).filter((t) => t.state === "LIBRE" || t.state === "RESERVADA").map((t) => ({ id: t.id, name: t.name, area: data?.areas.find((a) => a.id === t.area_id)?.name || "" })), [data]);
  const openOrders = useMemo(() => (data?.tables || []).filter((t) => t.order_id).map((t) => ({ id: t.order_id as number, title: `Mesa ${t.name}` })), [data]);
  const ready = (data?.tables || []).reduce((s, t) => s + t.ready_count, 0);

  return (
    <div className="r2-page">
      <PageHeader eyebrow="SERVICIO" title="Salón" subtitle="Tocá una mesa para abrirla o seguir su cuenta.">
        <button className="secondary-button" onClick={() => setEighty(true)}>Platos agotados (86)</button>
        <Seg value={mode} onChange={setMode} options={[["plano", "Plano"], ["lista", "Lista"]]} />
      </PageHeader>
      {!online && <div className="r2-offline" role="status">Sin conexión. Lo que cargues se guarda en este equipo y se envía solo cuando vuelva internet.</div>}
      {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}

      {data && (
        <div className="rs-kpis">
          <div className="rs-kpi"><span>Mesas libres</span><strong>{data.summary.free}</strong></div>
          <div className="rs-kpi"><span>Mesas ocupadas</span><strong>{data.summary.occupied}</strong><small>{data.summary.covers} comensales</small></div>
          <div className={`rs-kpi ${ready ? "is-warn" : ""}`}><span>Platos listos para servir</span><strong>{ready}</strong></div>
        </div>
      )}

      {calls.length > 0 && (
        <div className="r2-strip" role="region" aria-label="Avisos de mesas">
          {calls.map((c) => (
            <span key={c.id} className="r2-call">Mesa {c.table_name}: {c.kind === "CUENTA" ? "pide la cuenta" : "llama al mozo"} (hace {c.minutes} min)
              <button onClick={() => attend(c)}>Atendido</button></span>
          ))}
        </div>
      )}

      {!data && !error ? <Loading text="Cargando las mesas..." /> : data && (data.tables.length === 0 ? (
        <Empty title="Todavía no hay mesas">Cargá las zonas y mesas en Configuración y vas a verlas acá.</Empty>
      ) : (
        <>
          <div className="rs-toolbar">
            <div className="rs-seg" role="group" aria-label="Zona">
              <button className={area === "all" ? "is-on" : ""} onClick={() => setArea("all")}>Todas</button>
              {data.areas.map((a) => <button key={a.id} className={area === a.id ? "is-on" : ""} onClick={() => setArea(a.id)}>{a.name}</button>)}
            </div>
            {me?.role === "MOZO" && <label className="r2-check"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Solo mis mesas</label>}
            <div className="r2-legend">
              <span><i className="st-LIBRE" />Libre</span><span><i className="st-OCUPADA" />Ocupada</span>
              <span><i className="st-CUENTA_PEDIDA" />Pidió la cuenta</span><span><i className="st-RESERVADA" />Reservada</span>
            </div>
          </div>
          {tables.length === 0 ? <Empty title="No hay mesas con ese filtro" /> : area !== "all" ? (
            <Plano tables={tables} activeId={order?.table_id ?? null} onPick={openTable} list={mode === "lista"} />
          ) : data.areas.map((a) => {
            const mine = tables.filter((t) => t.area_id === a.id);
            return mine.length === 0 ? null : (
              <section key={a.id} className="rs-stack">{data.areas.length > 1 && <h3>{a.name}</h3>}
                <Plano tables={mine} activeId={order?.table_id ?? null} onPick={openTable} list={mode === "lista"} /></section>
            );
          })}
        </>
      ))}

      {opening && (
        <Modal eyebrow="ABRIR MESA" title={`Mesa ${opening.name}`} onClose={() => setOpening(null)}
          footer={<><button className="secondary-button" onClick={() => setOpening(null)}>Cancelar</button><button className="primary-button" disabled={busy} onClick={confirmOpen}>Abrir mesa</button></>}>
          <div className="r2-dialog">
            {opening.reservation && <div className="rs-note rs-note-info">Reservada a nombre de {opening.reservation.name} a las {opening.reservation.time} ({opening.reservation.party} personas).</div>}
            <Field label="Comensales" hint={`La mesa tiene ${opening.seats} lugares.`}><input type="number" min={1} max={60} value={covers} onChange={(e) => setCovers(e.target.value)} autoFocus /></Field>
          </div>
        </Modal>
      )}

      {order && (
        <Modal eyebrow="CUENTA" title={order.title} size="xl" onClose={() => { setOrder(null); load(); }}>
          <Workspace order={order} channel="SALON" free={free} openOrders={openOrders} waiters={waiters} onOrder={(o) => { setOrder(o); onOrder(o); }}
            onFail={fail} onOk={show} onPrint={setDocs} onPay={setPaying} onClose={() => { setOrder(null); load(); }} defaultMenu={order.items.length === 0} />
        </Modal>
      )}
      {paying && (
        <CobroModal order={paying} onClose={() => setPaying(null)} onOrder={(o) => { setOrder((c) => (c && c.id === o.id ? o : c)); setPaying(o); load(); }} onPrint={setDocs} onFail={fail} onOk={show} />
      )}
      {eighty && <EightySix source="salon" channel="SALON" onClose={() => setEighty(false)} onFail={fail} onOk={show} />}
      {docs.length > 0 && <PrintPreview doc={docs[0]} onClose={() => setDocs((d) => d.slice(1))} />}
      {node}
    </div>
  );
}
