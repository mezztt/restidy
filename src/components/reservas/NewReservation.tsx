import { useEffect, useState } from "react";
import { appApi } from "../../config";
import { Field, Modal } from "../ui";
import type { Avail } from "./types";

/** Reserva cargada por el local (teléfono, mostrador): muestra los horarios con lugar */
export default function NewReservation({ day, onClose, onDone, onFail }: { day: string; onClose: () => void; onDone: (msg: string) => void; onFail: (e: unknown) => void }) {
  const [date, setDate] = useState(day);
  const [party, setParty] = useState(2);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAvail(null); setTime("");
    appApi<Avail>(`/reservations/availability?date=${date}&party_size=${party}`).then(setAvail).catch(onFail);
  }, [date, party]); // eslint-disable-line react-hooks/exhaustive-deps

  const slot = avail?.slots.find((s) => s.time === time);
  async function save() {
    setError("");
    if (name.trim().length < 2) return setError("Falta el nombre");
    if (!time) return setError("Elegí un horario");
    setBusy(true);
    try {
      const r = await appApi<{ id: number }>("/reservations", { method: "POST", body: {
        customer_name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, party_size: party, day: date, time, notes: notes.trim() || null,
        table_ids: slot && slot.table_ids.length ? slot.table_ids : null, force,
      } });
      void r; onDone("Reserva guardada");
    } catch (e) { onFail(e); } finally { setBusy(false); }
  }
  return (
    <Modal title="Reserva nueva" eyebrow="Reservas" onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={save}>Guardar reserva</button></>}>
      <div className="r3-detail">
        <div className="r3-form">
          <Field label="Día"><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <Field label="Personas"><input type="number" min={1} max={100} value={party} onChange={(e) => setParty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></Field>
        </div>
        <div>
          <h3>Horarios</h3>
          {!avail ? <p className="r2-muted">Buscando lugar...</p> : avail.slots.length === 0 ? <div className="rs-note rs-note-warn">{avail.closed_reason || "No hay turnos de reserva ese día. Cargalos en la pestaña Turnos."}</div> : (
            <div className="r3-slots">{avail.slots.map((s) => (
              <button key={s.time + s.period_id} type="button" className={`r3-slot ${time === s.time ? "is-on" : ""}`} disabled={!s.available && !force} title={s.reason || ""} onClick={() => setTime(s.time)}>{s.time}</button>
            ))}</div>
          )}
          {slot && !slot.available && <p className="r2-muted">{slot.reason}</p>}
          <label className="r3-chk" style={{ marginTop: 8 }}><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Reservar igual aunque figure completo</label>
        </div>
        <div className="r3-form">
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Teléfono"><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Email (opcional)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Aclaraciones" wide><input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Cumpleaños, silla de bebé..." /></Field>
        </div>
        {error && <div className="rs-note rs-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
