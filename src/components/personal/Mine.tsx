import { useState } from "react";
import { appApi, hhmm, longDate, parseDay, shortDate } from "../../config";
import { Empty, Loading, Pill } from "../ui";
import { usePoll } from "../salon/hooks";
import { ClockModal } from "./Attendance";
import type { Shift } from "./types";

interface Me { linked: boolean; shifts: Shift[]; clocked_in: boolean; since: string | null; staff?: { id: number; name: string } }

/** Vista de quien no es encargado: su horario y fichar */
export default function Mine({ onFail, onOk }: { onFail: (e: unknown) => void; onOk: (t: string) => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [clock, setClock] = useState(false);
  const load = () => appApi<Me>("/me/schedule").then(setMe).catch(onFail);
  usePoll(load, 30000);
  if (!me) return <Loading />;
  if (!me.linked) return <Empty title="Tu usuario todavía no está vinculado a una ficha">Pedile al encargado que lo vincule en Personal, Equipo.</Empty>;
  return (
    <div className="r3-page">
      <div className="r3-courier-card r3-clock">
        {me.clocked_in ? <Pill tone="green">Fichado desde las {hhmm(me.since!)}</Pill> : <Pill tone="gray">Todavía no fichaste</Pill>}
        <button className={`${me.clocked_in ? "secondary-button" : "primary-button"} r3-big-btn`} onClick={() => setClock(true)}>{me.clocked_in ? "Fichar salida" : "Fichar entrada"}</button>
      </div>
      <h3>Tu horario</h3>
      {me.shifts.length === 0 ? <Empty title="No tenés turnos cargados" /> : (
        <div className="r3-grid">{me.shifts.map((s) => (
          <div key={s.id} className="r3-courier-card"><strong>{longDate(parseDay(s.date))}</strong><span>{s.start_time} a {s.end_time}{s.area ? ` · ${s.area}` : ""}</span><small className="r2-muted">{shortDate(s.date)} · {s.hours.toFixed(1).replace(".", ",")} h</small></div>))}</div>
      )}
      {clock && me.staff && <ClockModal who={{ staff_id: me.staff.id, name: me.staff.name, clocked_in: me.clocked_in }} onClose={() => setClock(false)} onFail={onFail} onDone={(m) => { setClock(false); onOk(m); load(); }} />}
    </div>
  );
}
