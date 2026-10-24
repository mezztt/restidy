import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { publicApi, money, longDate, parseDay } from "../../config";
import { Consent, Shell } from "../../components/public/Shell";
import type { Venue } from "../../components/r3/types";

interface Config {
  venue: Venue; accepting: boolean; periods: { name: string; open_time: string; close_time: string }[]; max_party_size: number; max_days_ahead: number;
  deposit_required: boolean; deposit_per_person: number; refund_policy: string | null; cancel_hours: number; today: string;
}
interface Slot { time: string; period_name: string; available: boolean; reason: string | null }
interface Avail { date: string; duration_min: number; closed_reason: string | null; slots: Slot[] }

export default function ReservarMesa() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [party, setParty] = useState(2);
  const [day, setDay] = useState("");
  const [avail, setAvail] = useState<Avail | null>(null);
  const [time, setTime] = useState("");
  const [f, setF] = useState({ name: "", phone: "", email: "", notes: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    publicApi<Config>(`/public/${slug}/reservations/config`).then((c) => { setCfg(c); setDay(c.today); }).catch((e) => setError(e instanceof Error ? e.message : "No pudimos abrir las reservas"));
  }, [slug]);
  useEffect(() => {
    if (!cfg || !day) return;
    setAvail(null); setTime("");
    publicApi<Avail>(`/public/${slug}/reservations/availability?date=${day}&party_size=${party}`).then(setAvail).catch((e) => setMsg(e instanceof Error ? e.message : "No pudimos buscar horarios"));
  }, [cfg, day, party, slug]);

  const maxDay = cfg ? new Date(parseDay(cfg.today).getTime() + cfg.max_days_ahead * 86400000) : null;
  const maxKey = maxDay ? `${maxDay.getFullYear()}-${String(maxDay.getMonth() + 1).padStart(2, "0")}-${String(maxDay.getDate()).padStart(2, "0")}` : undefined;
  const ready = !!time && f.name.trim().length >= 2 && f.phone.replace(/\D/g, "").length >= 6 && consent;
  const deposit = cfg?.deposit_required ? cfg.deposit_per_person * party : 0;

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const r = await publicApi<{ token: string; checkout_url: string | null }>(`/public/${slug}/reservations`, { method: "POST", body: {
        customer_name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || null, party_size: party, day, time, notes: f.notes.trim() || null, consent, pay_deposit: true } });
      if (r.checkout_url) window.location.href = r.checkout_url; else nav(`/seguimiento/${r.token}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "No pudimos guardar la reserva"); setBusy(false); }
  }

  return (
    <Shell title="Reservar mesa" venue={cfg?.venue || null} heading="Reservá tu mesa" intro="Elegí el día, la hora y cuántos son. Te confirmamos al instante." error={error}>
      {cfg && !cfg.accepting && <div className="pb-card"><div className="pb-soon"><b>Por ahora no tomamos reservas online</b>Llamanos{cfg.venue.phone ? ` al ${cfg.venue.phone}` : ""} para reservar.</div></div>}
      {cfg && cfg.accepting && (
        <>
          <div className="pb-card">
            <span className="pb-step-label">1 · Cuántos y cuándo</span>
            <div className="pb-row">
              <div className="pb-field"><label htmlFor="pers">Personas</label><input id="pers" type="number" min={1} max={cfg.max_party_size || 100} value={party} onChange={(e) => setParty(Math.max(1, Math.min(cfg.max_party_size || 100, Number(e.target.value) || 1)))} /></div>
              <div className="pb-field"><label htmlFor="dia">Día</label><input id="dia" type="date" min={cfg.today} max={maxKey} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></div>
            </div>
            {day && <p className="r3-pub-legal" style={{ marginTop: 0 }}>{longDate(parseDay(day))}. Hasta {cfg.max_party_size} personas por reserva; para más, llamanos.</p>}
            {!avail ? <p className="r3-pub-legal">Buscando lugar...</p> : avail.slots.length === 0 ? <div className="r3-pub-note">{avail.closed_reason || "Ese día no tomamos reservas. Probá con otro."}</div> : (
              <div className="r3-slots" role="group" aria-label="Horarios">
                {avail.slots.map((s) => <button key={s.time} type="button" className={`r3-slot ${time === s.time ? "is-on" : ""}`} disabled={!s.available} title={s.reason || ""} aria-pressed={time === s.time} onClick={() => setTime(s.time)}>{s.time}</button>)}
              </div>
            )}
            {avail && avail.slots.length > 0 && !avail.slots.some((s) => s.available) && <div className="r3-pub-note" style={{ marginTop: 10 }}>No queda lugar para {party} ese día. Probá con otro día o con menos personas.</div>}
          </div>
          {time && (
            <div className="pb-card">
              <span className="pb-step-label">2 · Tus datos</span>
              <div className="pb-field"><label htmlFor="n">Nombre</label><input id="n" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="pb-row">
                <div className="pb-field"><label htmlFor="t">Teléfono</label><input id="t" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                <div className="pb-field"><label htmlFor="e">Email (opcional)</label><input id="e" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              </div>
              <div className="pb-field"><label htmlFor="o">Aclaraciones (opcional)</label><input id="o" maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Cumpleaños, silla de bebé, cochecito..." /></div>
              {deposit > 0 && <div className="r3-pub-note">Para confirmar la reserva pedimos una seña de <b>{money(deposit)}</b> ({money(cfg.deposit_per_person)} por persona), que pagás con Mercado Pago. La reserva se confirma cuando Mercado Pago avisa el pago; si no pagás en 30 minutos, se libera la mesa.{cfg.refund_policy ? ` ${cfg.refund_policy}` : ""}</div>}
              <p className="r3-pub-legal" style={{ marginTop: 0 }}>Podés cancelar hasta {cfg.cancel_hours} h antes desde el enlace que te mostramos al confirmar.</p>
              <Consent checked={consent} onChange={setConsent} />
              {msg && <div className="pb-error" role="alert">{msg}</div>}
              <button className="pb-btn" disabled={!ready || busy} onClick={submit}>{busy ? "Guardando..." : deposit > 0 ? `Pagar seña de ${money(deposit)} y reservar` : "Confirmar reserva"}</button>
            </div>
          )}
        </>
      )}
      {!cfg && !error && <div className="pb-card"><div className="pb-soon"><b>Cargando...</b></div></div>}
    </Shell>
  );
}
