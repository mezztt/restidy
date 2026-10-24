import { useEffect, useState } from "react";
import { appApi, dateTime, dayKey, addDays, hhmm } from "../../config";
import { Empty, Field, Loading, Modal, Pill } from "../ui";
import { usePoll } from "../salon/hooks";
import type { AttRow, BoardRow } from "./types";

/** Ventana para fichar con PIN */
export function ClockModal({ who, onClose, onDone, onFail }: { who: { staff_id: number; name: string; clocked_in: boolean }; onClose: () => void; onDone: (msg: string) => void; onFail: (e: unknown) => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { const r = await appApi<{ detail: string; warning: string | null }>("/attendance/clock", { method: "POST", body: { staff_id: who.staff_id, pin } }); onDone(r.detail + (r.warning ? ` · ${r.warning}` : "")); }
    catch (e) { onFail(e); setPin(""); } finally { setBusy(false); }
  }
  return (
    <Modal title={who.clocked_in ? `Fichar la salida de ${who.name}` : `Fichar la entrada de ${who.name}`} eyebrow="Asistencia" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button r3-big-btn" disabled={busy || pin.length < 4} onClick={go}>{who.clocked_in ? "Registrar salida" : "Registrar entrada"}</button></>}>
      <Field label="PIN"><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} autoFocus onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && go()} placeholder="4 a 6 números" /></Field>
    </Modal>
  );
}

export default function Attendance({ boss, onFail, onOk }: { boss: boolean; onFail: (e: unknown) => void; onOk: (t: string) => void }) {
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [rows, setRows] = useState<AttRow[] | null>(null);
  const [who, setWho] = useState<BoardRow | null>(null);
  const [fix, setFix] = useState<AttRow | null>(null);
  const [from, setFrom] = useState(dayKey(addDays(new Date(), -6)));
  const [to, setTo] = useState(dayKey(new Date()));
  const [fixIn, setFixIn] = useState("");
  const [fixOut, setFixOut] = useState("");
  const loadBoard = () => appApi<BoardRow[]>("/attendance/board").then(setBoard).catch(onFail);
  usePoll(loadBoard, 30000);
  const loadRows = () => { if (boss) appApi<AttRow[]>(`/attendance?from_date=${from}&to_date=${to}`).then(setRows).catch(onFail); };
  useEffect(loadRows, [from, to, boss]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveFix() {
    if (!fix) return;
    try {
      await appApi(`/attendance/${fix.id}`, { method: "PUT", body: { in_at: fixIn || null, out_at: fixOut || "" } });
      setFix(null); loadRows(); loadBoard(); onOk("Fichaje corregido");
    } catch (e) { onFail(e); }
  }
  const local = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

  return (
    <div className="r3-page">
      <h3>Ahora</h3>
      {!board ? <Loading /> : board.length === 0 ? <Empty title={boss ? "No hay nadie cargado" : "Tu usuario no está vinculado a una ficha de personal"}>{boss ? "Cargá al equipo en la pestaña Equipo." : "Pedile al encargado que lo vincule para poder fichar."}</Empty> : (
        <div className="r3-board-staff">{board.map((b) => (
          <div key={b.staff_id} className="r3-staff-card">
            <strong>{b.name}</strong>
            <small>{b.job || "Sin puesto"}{b.shift_today ? ` · hoy ${b.shift_today}` : ""}</small>
            <div className="r3-chips">{b.clocked_in ? <Pill tone="green">Trabajando desde las {hhmm(b.since!)}</Pill> : <Pill tone="gray">Fuera</Pill>}</div>
            <button className={b.clocked_in ? "secondary-button" : "primary-button"} onClick={() => setWho(b)}>{b.clocked_in ? "Fichar salida" : "Fichar entrada"}</button>
          </div>))}</div>
      )}
      {boss && (
        <>
          <h3>Historial</h3>
          <div className="r3-form"><Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
          {!rows ? <Loading /> : rows.length === 0 ? <Empty title="Sin fichajes en esas fechas" /> : (
            <div className="r3-scroll"><table className="r3-table"><thead><tr><th>Persona</th><th>Entrada</th><th>Salida</th><th className="num">Horas</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{dateTime(r.in_at)}</td><td>{r.out_at ? dateTime(r.out_at) : <Pill tone="green">Abierto</Pill>}</td><td className="num">{r.hours.toFixed(2).replace(".", ",")}</td>
                  <td><button className="r2-mini" onClick={() => { setFix(r); setFixIn(local(r.in_at)); setFixOut(local(r.out_at)); }}>Corregir</button></td></tr>))}</tbody></table></div>
          )}
        </>
      )}
      {who && <ClockModal who={who} onClose={() => setWho(null)} onFail={onFail} onDone={(m) => { setWho(null); onOk(m); loadBoard(); loadRows(); }} />}
      {fix && (
        <Modal title={`Corregir fichaje de ${fix.name}`} eyebrow="Queda registrado en la auditoría" onClose={() => setFix(null)}
          footer={<><button className="secondary-button" onClick={() => setFix(null)}>Cancelar</button><button className="primary-button" onClick={saveFix}>Guardar</button></>}>
          <div className="r3-form">
            <Field label="Entrada"><input type="datetime-local" value={fixIn} onChange={(e) => setFixIn(e.target.value)} /></Field>
            <Field label="Salida" hint="Vacío = sigue abierto."><input type="datetime-local" value={fixOut} onChange={(e) => setFixOut(e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
