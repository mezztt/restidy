import { useCallback, useEffect, useRef, useState } from "react";
import "../../../r2.css";
import "../../../r3.css";
import { appApi, getSessionUser, hhmm, money } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Tabs, useFlash } from "../../../components/ui";
import { NETWORK_ERROR, beep, usePoll } from "../../../components/salon/hooks";
import { DateNav } from "../../../components/r3/kit";
import DetailModal from "../../../components/delivery/DetailModal";
import NewOrder from "../../../components/delivery/NewOrder";
import { CouriersTab, ZonesTab } from "../../../components/delivery/Setup";
import { SOURCE_LABEL, STATUS_TONE, isLate } from "../../../components/delivery/types";
import type { Courier, DeliveryRow, Zone } from "../../../components/delivery/types";

const COLUMNS: [string, string][] = [["NUEVO", "Nuevos"], ["CONFIRMADO", "Confirmados"], ["EN_PREPARACION", "En preparación"], ["LISTO", "Listos"], ["EN_CAMINO", "En camino"]];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function DeliveryIndex() {
  const me = getSessionUser();
  const role = me?.role || "";
  const repartidor = role === "REPARTIDOR";
  const canWrite = ["ADMINISTRADOR", "ENCARGADO", "CAJERO"].includes(role);
  const canManage = ["ADMINISTRADOR", "ENCARGADO"].includes(role);
  const [tab, setTab] = useState<"tablero" | "historial" | "zonas" | "repartidores">("tablero");
  const [rows, setRows] = useState<DeliveryRow[] | null>(null);
  const [hist, setHist] = useState<DeliveryRow[] | null>(null);
  const [day, setDay] = useState(today());
  const [zones, setZones] = useState<Zone[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [linked, setLinked] = useState(true);
  const [open, setOpen] = useState<DeliveryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const seen = useRef<Set<number> | null>(null);
  const { show, fail, node } = useFlash();

  const load = useCallback(() => {
    const url = repartidor ? "/me/deliveries" : "/deliveries?scope=board";
    appApi<{ items: DeliveryRow[]; linked?: boolean }>(url).then((r) => {
      setRows(r.items); setError(""); if (r.linked !== undefined) setLinked(r.linked);
      // pitido cuando entra un pedido nuevo
      const ids = new Set(r.items.filter((d) => d.status === "NUEVO").map((d) => d.id));
      if (seen.current && [...ids].some((i) => !seen.current!.has(i))) beep();
      seen.current = ids;
    }).catch((e) => { if (e instanceof Error && e.message !== NETWORK_ERROR) setError(e.message); });
  }, [repartidor]);
  usePoll(load, 8000);

  const loadSetup = useCallback(() => {
    if (!canWrite) return;
    appApi<Zone[]>("/delivery-zones").then(setZones).catch(() => undefined);
    appApi<Courier[]>("/couriers").then(setCouriers).catch(() => undefined);
  }, [canWrite]);
  useEffect(() => { loadSetup(); }, [loadSetup]);
  useEffect(() => {
    if (tab !== "historial") return;
    setHist(null);
    appApi<{ items: DeliveryRow[] }>(`/deliveries?scope=history&day=${day}`).then((r) => setHist(r.items)).catch(fail);
  }, [tab, day]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openRow(d: DeliveryRow) {
    try { setOpen(await appApi<DeliveryRow>(`/deliveries/${d.id}`)); } catch (e) { fail(e); }
  }
  const changed = (d: DeliveryRow) => { setOpen(d); load(); loadSetup(); };

  function card(d: DeliveryRow) {
    return (
      <button key={d.id} type="button" className={`r3-dcard ${isLate(d) ? "is-late" : ""}`} onClick={() => openRow(d)}>
        <div className="r3-dcard-top"><strong>#{String(d.number).padStart(3, "0")} · {d.customer_name}</strong><span className="r3-money">{money(d.total)}</span></div>
        <small>{d.items_brief || "Sin platos"}</small>
        {d.kind === "DELIVERY" && d.address && <small>{d.address}{d.zone_name ? ` · ${d.zone_name}` : ""}</small>}
        <div className="r3-chips">
          <Pill tone={d.kind === "DELIVERY" ? "violet" : "blue"}>{d.kind === "DELIVERY" ? "Delivery" : "Retira"}</Pill>
          <Pill tone="gray">{SOURCE_LABEL[d.source] || d.source}</Pill>
          {d.promised_at && <Pill tone={isLate(d) ? "red" : "gray"}>{isLate(d) ? "Atrasado · " : "Para las "}{hhmm(d.promised_at)}</Pill>}
          {d.kind === "DELIVERY" && !d.courier_id && !["ENTREGADO", "CANCELADO"].includes(d.status) && <Pill tone="orange">Sin repartidor</Pill>}
          {d.courier_name && <Pill tone="green">{d.courier_name}</Pill>}
          {d.has_allergy && <Pill tone="red">Alergia</Pill>}
          {d.to_collect > 0 && <Pill tone="orange">Cobrar {money(d.to_collect)}</Pill>}
        </div>
      </button>
    );
  }

  // ----- vista del repartidor -----
  if (repartidor) {
    const active = (rows || []).filter((d) => !["ENTREGADO", "CANCELADO"].includes(d.status));
    const done = (rows || []).filter((d) => d.status === "ENTREGADO");
    return (
      <div className="r3-page">
        <PageHeader eyebrow="SERVICIO" title="Mis entregas" subtitle="Tocá un pedido para ver la dirección y marcarlo en camino o entregado." />
        {error && <div className="rs-note rs-note-error">{error}</div>}
        {!linked && <div className="rs-note rs-note-warn">Tu usuario todavía no está vinculado a un repartidor. Pedile al encargado que lo vincule en Delivery, Repartidores.</div>}
        {!rows ? <Loading /> : active.length === 0 ? <Empty title="No tenés entregas pendientes">Cuando te asignen un pedido te llega un aviso.</Empty> : <div className="r3-grid">{active.map(card)}</div>}
        {done.length > 0 && <><h3>Entregadas hoy</h3><div className="r3-grid">{done.map(card)}</div></>}
        {open && <DetailModal row={open} couriers={[]} canWrite={false} repartidor onClose={() => setOpen(null)} onChange={changed} onFail={fail} onOk={show} />}
        {node}
      </div>
    );
  }

  const tabs: [typeof tab, string][] = [["tablero", "Tablero"], ["historial", "Historial"]];
  if (canWrite) tabs.push(["zonas", "Zonas"], ["repartidores", "Repartidores"]);
  const waiting = (rows || []).filter((d) => d.status === "PENDIENTE_PAGO");
  const finished = (rows || []).filter((d) => ["ENTREGADO", "RETIRADO", "CANCELADO"].includes(d.status));

  return (
    <div className="r3-page">
      <PageHeader eyebrow="SERVICIO" title="Delivery y take-away" subtitle="Pedidos por teléfono, mostrador y web con zonas, repartidores y hora prometida.">
        {canWrite && <button className="primary-button" data-tour="delivery-nuevo" onClick={() => setCreating(true)}>Pedido nuevo</button>}
      </PageHeader>
      <Tabs value={tab} options={tabs} onChange={setTab} />
      {error && <div className="rs-note rs-note-error">{error}</div>}

      {tab === "tablero" && (!rows ? <Loading /> : (
        <>
          {waiting.length > 0 && (
            <div className="rs-note rs-note-info"><strong>Esperando el pago online ({waiting.length}).</strong> Pasan solos a cocina cuando Mercado Pago confirma; si no pagan en 30 minutos se cancelan.
              <div className="r3-grid">{waiting.map(card)}</div></div>
          )}
          {rows.length === 0 && <Empty title="Todavía no hay pedidos hoy">Cuando cargues uno o entre uno por la web, aparece acá.</Empty>}
          <div className="r3-board" data-tour="delivery-tablero">
            {COLUMNS.map(([st, label]) => {
              const list = rows.filter((d) => d.status === st);
              return (
                <section key={st} className="r3-col" aria-label={label}>
                  <div className="r3-col-head">{label}<span>{list.length}</span></div>
                  {list.map(card)}
                  {list.length === 0 && <p className="r2-muted">Sin pedidos</p>}
                </section>
              );
            })}
          </div>
          {finished.length > 0 && <><h3>Terminados hoy</h3><div className="r3-grid">{finished.map(card)}</div></>}
        </>
      ))}

      {tab === "historial" && (
        <>
          <DateNav day={day} onChange={setDay} />
          {!hist ? <Loading /> : hist.length === 0 ? <Empty title="Sin pedidos ese día" /> : (
            <div className="r3-scroll"><table className="r3-table"><thead><tr><th>N°</th><th>Hora</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th className="num">Total</th></tr></thead>
              <tbody>{hist.map((d) => (
                <tr key={d.id} onClick={() => openRow(d)} style={{ cursor: "pointer" }}>
                  <td>#{String(d.number).padStart(3, "0")}</td><td>{hhmm(d.created_at)}</td><td>{d.customer_name}</td>
                  <td>{d.kind === "DELIVERY" ? "Delivery" : "Retira"} · {SOURCE_LABEL[d.source] || d.source}</td>
                  <td><Pill tone={STATUS_TONE[d.status] || "gray"}>{d.status_label}</Pill></td><td className="num">{money(d.total)}</td></tr>
              ))}</tbody></table></div>
          )}
        </>
      )}
      {tab === "zonas" && <ZonesTab zones={zones} canEdit={canManage} reload={loadSetup} onFail={fail} onOk={show} />}
      {tab === "repartidores" && <CouriersTab couriers={couriers} canEdit={canManage} reload={loadSetup} onFail={fail} onOk={show} />}

      {creating && <NewOrder zones={zones} onClose={() => setCreating(false)} onFail={fail}
        onCreated={(d) => { setCreating(false); show(`Pedido #${String(d.number).padStart(3, "0")} enviado a cocina`); load(); }} />}
      {open && <DetailModal row={open} couriers={couriers} canWrite={canWrite} repartidor={false} onClose={() => setOpen(null)} onChange={changed} onFail={fail} onOk={show} />}
      {node}
    </div>
  );
}
