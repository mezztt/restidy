import { useCallback, useEffect, useState } from "react";
import "../../../r2.css";
import "../../../r3.css";
import { appApi, getSessionUser, money } from "../../../config";
import { Empty, Field, Loading, PageHeader, Pill, Tabs, useFlash } from "../../../components/ui";
import { NETWORK_ERROR, usePoll } from "../../../components/salon/hooks";
import { DateNav } from "../../../components/r3/kit";
import NewReservation from "../../../components/reservas/NewReservation";
import ResDetail from "../../../components/reservas/ResDetail";
import Periods from "../../../components/reservas/Periods";
import { STATUS_TONE } from "../../../components/reservas/types";
import type { DayData, Period, Res, WaitRow } from "../../../components/reservas/types";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function ReservasIndex() {
  const role = getSessionUser()?.role || "";
  const canManage = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const canWait = canManage || role === "MOZO";
  const [tab, setTab] = useState<"agenda" | "espera" | "turnos">("agenda");
  const [day, setDay] = useState(today());
  const [data, setData] = useState<DayData | null>(null);
  const [wait, setWait] = useState<WaitRow[] | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [blocked, setBlocked] = useState<{ id: number; date: string; period_id: number | null; reason: string | null }[]>([]);
  const [open, setOpen] = useState<Res | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [w, setW] = useState({ name: "", phone: "", party: 2, minutes: "" });
  const { show, fail, node } = useFlash();

  const load = useCallback(() => {
    appApi<DayData>(`/reservations/day?date=${day}`).then((r) => { setData(r); setError(""); })
      .catch((e) => { if (e instanceof Error && e.message !== NETWORK_ERROR) setError(e.message); });
  }, [day]);
  usePoll(load, 15000, [day]);
  const loadWait = useCallback(() => { appApi<WaitRow[]>("/waitlist").then(setWait).catch(fail); }, [fail]);
  const loadPeriods = useCallback(() => {
    appApi<Period[]>("/service-periods").then(setPeriods).catch(() => undefined);
    appApi<any[]>("/blocked-dates").then(setBlocked).catch(() => undefined);
    load();
  }, [load]);
  useEffect(() => { if (tab === "espera") loadWait(); if (tab === "turnos") loadPeriods(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addWait() {
    if (w.name.trim().length < 2) return;
    try {
      await appApi("/waitlist", { method: "POST", body: { name: w.name.trim(), phone: w.phone.trim() || null, party_size: w.party, quoted_minutes: w.minutes ? Number(w.minutes) : null } });
      setW({ name: "", phone: "", party: 2, minutes: "" }); loadWait();
    } catch (e) { fail(e); }
  }
  async function waitStatus(id: number, status: string) {
    try { await appApi(`/waitlist/${id}`, { method: "PATCH", body: { status } }); loadWait(); } catch (e) { fail(e); }
  }
  async function waitDelete(id: number) {
    try { await appApi(`/waitlist/${id}`, { method: "DELETE" }); loadWait(); } catch (e) { fail(e); }
  }

  const tabs: [typeof tab, string][] = [["agenda", "Agenda"]];
  if (canWait) tabs.push(["espera", "Lista de espera"]);
  if (canManage) tabs.push(["turnos", "Turnos y bloqueos"]);
  const alive = (data?.reservations || []).filter((r) => ["CONFIRMADA", "PENDIENTE_SENIA", "SENTADA"].includes(r.status));
  const rest = (data?.reservations || []).filter((r) => !alive.includes(r));

  const row = (r: Res) => (
    <button key={r.id} type="button" className={`r3-res ${["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(r.status) ? "is-off" : ""}`} onClick={() => setOpen(r)}>
      <time>{r.time}</time>
      <div><strong>{r.customer_name}</strong> · {r.party_size} pers.
        <small>{r.table_names.length ? r.table_names.join(" + ") : "Sin mesa"}{r.notes ? ` · ${r.notes}` : ""}</small></div>
      <div className="r3-chips">
        <Pill tone={STATUS_TONE[r.status] || "gray"}>{r.status_label}</Pill>
        {r.no_show_flag && <Pill tone="red">No vino {r.customer_no_shows}×</Pill>}
        {r.deposit_amount > 0 && <Pill tone={r.deposit_status === "APROBADA" ? "green" : "orange"}>Seña {money(r.deposit_amount)}</Pill>}
      </div>
    </button>
  );

  return (
    <div className="r3-page">
      <PageHeader eyebrow="SERVICIO" title="Reservas" subtitle="Agenda del día, lista de espera y turnos con cupo por horario.">
        {canManage && <button className="primary-button" data-tour="reservas-nueva" onClick={() => setCreating(true)}>Reserva nueva</button>}
      </PageHeader>
      <Tabs value={tab} options={tabs} onChange={setTab} />
      {error && <div className="rs-note rs-note-error">{error}</div>}

      {tab === "agenda" && (
        <>
          <div className="r3-sub"><DateNav day={day} onChange={setDay} />
            {data && <span className="r2-muted"><b>{data.totals.reservations}</b> reservas · <b>{data.totals.covers}</b> personas</span>}</div>
          {data && data.blocked.length > 0 && <div className="rs-note rs-note-warn">Ese día no se toman reservas{data.blocked[0].reason ? `: ${data.blocked[0].reason}` : ""}.</div>}
          {data && data.periods.length === 0 && canManage && <div className="rs-note rs-note-info">No hay turnos configurados para este día. Creálos en «Turnos y bloqueos» para aceptar reservas, también por la web.</div>}
          {!data ? <Loading /> : data.reservations.length === 0 ? <Empty title="No hay reservas para este día">{canManage ? "Cargá una con «Reserva nueva» o esperá las de la web." : "Cuando haya reservas aparecen acá."}</Empty> : (
            <div className="r3-page" style={{ gap: 8 }}>{alive.map(row)}{rest.length > 0 && <><h3>Terminadas y canceladas</h3>{rest.map(row)}</>}</div>
          )}
        </>
      )}

      {tab === "espera" && (
        <>
          <p className="r2-muted">Gente que llegó sin reserva y espera mesa. Pasá a «Sentado» cuando se acomode.</p>
          <div className="r3-form">
            <Field label="Nombre"><input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} /></Field>
            <Field label="Teléfono"><input inputMode="tel" value={w.phone} onChange={(e) => setW({ ...w, phone: e.target.value })} /></Field>
            <Field label="Personas"><input type="number" min={1} max={100} value={w.party} onChange={(e) => setW({ ...w, party: Number(e.target.value) || 1 })} /></Field>
            <Field label="Le dijimos (min)"><input type="number" min={0} value={w.minutes} onChange={(e) => setW({ ...w, minutes: e.target.value })} /></Field>
            <div className="form-group" style={{ alignSelf: "end" }}><button className="primary-button" onClick={addWait} disabled={w.name.trim().length < 2}>Anotar</button></div>
          </div>
          {!wait ? <Loading /> : wait.length === 0 ? <Empty title="No hay nadie esperando" /> : (
            <div className="r3-grid">{wait.map((x) => (
              <div key={x.id} className="r3-courier-card">
                <strong>{x.name} · {x.party_size} pers.</strong>
                <span className="r2-muted">{x.phone || "Sin teléfono"}</span>
                <div className="r3-chips"><Pill tone={x.status === "ESPERANDO" ? "orange" : "gray"}>{x.status === "ESPERANDO" ? `Espera hace ${x.waiting_min} min` : x.status === "SENTADO" ? "Se sentó" : "Se fue"}</Pill>{x.quoted_minutes != null && <Pill tone="gray">Dijimos {x.quoted_minutes} min</Pill>}</div>
                <div className="r2-btn-row">
                  {x.status === "ESPERANDO" && <><button className="r2-mini is-ok" onClick={() => waitStatus(x.id, "SENTADO")}>Sentado</button><button className="r2-mini" onClick={() => waitStatus(x.id, "SE_FUE")}>Se fue</button></>}
                  <button className="r2-mini is-danger" onClick={() => waitDelete(x.id)}>Quitar</button>
                </div>
              </div>))}</div>
          )}
        </>
      )}

      {tab === "turnos" && <Periods periods={periods} blocked={blocked} reload={loadPeriods} onFail={fail} onOk={show} />}

      {creating && <NewReservation day={day} onClose={() => setCreating(false)} onFail={fail} onDone={(m) => { setCreating(false); show(m); load(); }} />}
      {open && <ResDetail res={open} data={data} canManage={canManage} onClose={() => setOpen(null)} onFail={fail} onOk={show} onChanged={(r) => { setOpen(r); load(); }} />}
      {node}
    </div>
  );
}
