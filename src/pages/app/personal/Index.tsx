import { useCallback, useEffect, useState } from "react";
import "../../../r2.css";
import "../../../r3.css";
import { appApi, dayKey, getSessionUser } from "../../../config";
import { PageHeader, Pill, Tabs, useFlash } from "../../../components/ui";
import Grid from "../../../components/personal/Grid";
import Team from "../../../components/personal/Team";
import Attendance from "../../../components/personal/Attendance";
import Tips from "../../../components/personal/Tips";
import Mine from "../../../components/personal/Mine";
import type { Staff, Week } from "../../../components/personal/types";

function mondayOf(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayKey(x);
}

export default function PersonalIndex() {
  const role = getSessionUser()?.role || "";
  const boss = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const [tab, setTab] = useState<"turnos" | "equipo" | "asistencia" | "propinas" | "mio">(boss ? "turnos" : "mio");
  const [monday, setMonday] = useState(mondayOf(new Date()));
  const [week, setWeek] = useState<Week | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [expiring, setExpiring] = useState<Staff[]>([]);
  const { show, fail, node } = useFlash();

  const loadStaff = useCallback(() => {
    if (!boss) return;
    appApi<Staff[]>("/staff?include_inactive=true").then(setStaff).catch(fail);
    appApi<Staff[]>("/staff/expiring").then(setExpiring).catch(() => undefined);
  }, [boss, fail]);
  const loadWeek = useCallback(() => {
    if (!boss) return;
    appApi<Week>(`/staff-shifts?from_date=${monday}`).then(setWeek).catch(fail);
  }, [boss, monday, fail]);
  useEffect(loadStaff, [loadStaff]);
  useEffect(loadWeek, [loadWeek]);

  const tabs: [typeof tab, string][] = boss
    ? [["turnos", "Turnos"], ["equipo", "Equipo"], ["asistencia", "Asistencia"], ["propinas", "Propinas"]]
    : [["mio", "Mi horario"], ["propinas", "Mis propinas"]];

  return (
    <div className="r3-page">
      <PageHeader eyebrow="GESTIÓN" title="Personal" subtitle="Turnos de la semana, asistencia con PIN, carnets de manipulador y reparto de propinas." />
      {boss && expiring.length > 0 && (
        <div className="rs-note rs-note-warn"><strong>Carnets de manipulador:</strong>{" "}
          {expiring.map((s) => <Pill key={s.id} tone={s.carnet_state === "VENCIDO" ? "red" : "orange"}>{s.name} · {s.carnet_state === "VENCIDO" ? "vencido" : `vence en ${s.carnet_days_left} días`}</Pill>)}</div>
      )}
      <Tabs value={tab} options={tabs} onChange={setTab} />
      {tab === "turnos" && boss && <Grid week={week} staff={staff} monday={monday} onWeek={setMonday} reload={loadWeek} onFail={fail} onOk={show} />}
      {tab === "equipo" && boss && <Team staff={staff} reload={loadStaff} onFail={fail} onOk={show} />}
      {tab === "asistencia" && <Attendance boss={boss} onFail={fail} onOk={show} />}
      {tab === "propinas" && <Tips boss={boss} onFail={fail} onOk={show} />}
      {tab === "mio" && <Mine onFail={fail} onOk={show} />}
      {node}
    </div>
  );
}
