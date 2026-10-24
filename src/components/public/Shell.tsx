import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../../r2.css";
import "../../r3.css";
import { APP_NAME, OPENING_DAYS, money } from "../../config";
import { PoweredBy, RestidyLogo, useLightPage } from "../Brand";
import type { Venue } from "../r3/types";
import { ConsumerButtons } from "./ConsumerButtons";

/** Marco de las webs públicas del local: encabezado con sus datos, contenido y pie legal */
export function Shell({ title, venue, heading, intro, children, bar, error }: {
  title: string; venue: Venue | null; heading: string; intro?: string; children?: ReactNode; bar?: ReactNode; error?: string;
}) {
  useLightPage();
  useEffect(() => { document.title = `${venue?.name ? venue.name + " · " : ""}${title}`; }, [venue?.name, title]);
  return (
    <div className="pb-page r3-pub-page">
      <header className="pb-hero">
        <div className="pb-wrap">
          <div className="pb-top"><RestidyLogo size={38} /><div><strong>{venue?.name || APP_NAME}</strong><small>{[venue?.address, venue?.phone].filter(Boolean).join(" · ") || title}</small></div></div>
          <h1>{heading}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </header>
      <main className="pb-wrap pb-main">
        {error ? <div className="pb-card"><div className="pb-error" role="alert">{error}</div></div> : children}
        {venue && <VenueInfo venue={venue} />}
        {venue?.slug && !error && <ConsumerButtons slug={venue.slug} />}
      </main>
      {bar}
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}

function hoursText(venue: Venue): [string, string][] {
  return OPENING_DAYS.map(([k, label]) => [label, (venue.opening_hours?.[k] || []).map((r) => r.join(" a ")).join(" y ")] as [string, string]).filter(([, v]) => v);
}

/** Horarios, cargo por cubierto, precios finales y libro de quejas */
export function VenueInfo({ venue }: { venue: Venue }) {
  const hours = hoursText(venue);
  return (
    <div className="pb-card">
      <span className="pb-step-label">Sobre el local</span>
      {hours.length > 0 && <p style={{ margin: "0 0 8px" }}>{hours.map(([d, h]) => <span key={d} style={{ display: "block", color: "#2b1511", fontSize: 14 }}><b>{d}:</b> {h}</span>)}</p>}
      {venue.cover_charge_enabled && <p className="r3-pub-legal">Cubierto: {money(venue.cover_charge_amount)} por persona{venue.cover_charge_text ? ` (${venue.cover_charge_text})` : ""}.</p>}
      <p className="r3-pub-legal">{venue.price_notice}</p>
      {venue.complaints_book && <p className="r3-pub-legal">Este local tiene Libro de Quejas a disposición. Pedilo en el local.</p>}
    </div>
  );
}

export function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="r3-pub-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Acepto los <Link to="/legal/terminos">Términos</Link> y la <Link to="/legal/privacidad">Política de privacidad</Link>, y que el local use mis datos para atender este pedido o reserva (Ley 25.326).</span>
    </label>
  );
}

export function AllergyBlock({ notes, consent, onNotes, onConsent }: { notes: string; consent: boolean; onNotes: (v: string) => void; onConsent: (v: boolean) => void }) {
  return (
    <div className="pb-field">
      <label htmlFor="alergia">¿Tenés alguna alergia o sos celíaco? (opcional)</label>
      <input id="alergia" value={notes} maxLength={300} onChange={(e) => onNotes(e.target.value)} placeholder="Alergia al maní, celiaquía..." />
      {notes.trim() && (
        <label className="r3-pub-check" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
          <span>Acepto que el local use este dato de salud solo para preparar mi pedido con cuidado. Aviso: no podemos garantizar la ausencia total de trazas.</span>
        </label>
      )}
    </div>
  );
}
