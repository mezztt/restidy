import { useState } from "react";
import { appApi, dateTime, money, shortDate } from "../../config";
import { Field, Pill } from "../ui";
import { LEVEL_LABEL, LEVEL_TONE } from "./types";
import type { Cust } from "./types";

/** Ficha completa del cliente: consumo, direcciones, cuenta corriente */
export default function Detail({ c, canEdit, isBoss, onEdit, onChanged, onDeleted, onFail, onOk }: {
  c: Cust; canEdit: boolean; isBoss: boolean; onEdit: () => void; onChanged: () => void; onDeleted: () => void; onFail: (e: unknown) => void; onOk: (t: string) => void;
}) {
  const [addr, setAddr] = useState({ label: "", address: "", notes: "" });
  const [led, setLed] = useState({ kind: "PAGO", amount: "", note: "", method: "EFECTIVO", pin: "" });
  const [showLed, setShowLed] = useState(false);

  async function addAddress() {
    if (addr.address.trim().length < 3) return;
    try { await appApi(`/customers/${c.id}/addresses`, { method: "POST", body: { label: addr.label.trim() || null, address: addr.address.trim(), notes: addr.notes.trim() || null } }); setAddr({ label: "", address: "", notes: "" }); onChanged(); onOk("Dirección guardada"); } catch (e) { onFail(e); }
  }
  async function delAddress(id: number) {
    try { await appApi(`/customers/${c.id}/addresses/${id}`, { method: "DELETE" }); onChanged(); } catch (e) { onFail(e); }
  }
  async function saveLedger() {
    const amount = Number(led.amount.replace(",", "."));
    if (!(amount > 0)) return onFail(new Error("Poné un importe mayor a cero"));
    try {
      await appApi(`/customers/${c.id}/ledger`, { method: "POST", body: { kind: led.kind, amount, note: led.note.trim() || null, method: led.kind === "PAGO" ? led.method : null, pin: led.pin || null } });
      setLed({ kind: "PAGO", amount: "", note: "", method: "EFECTIVO", pin: "" }); setShowLed(false); onChanged(); onOk("Movimiento registrado");
    } catch (e) { onFail(e); }
  }
  async function erase() {
    if (!window.confirm(`Se borran los datos personales de ${c.name}. Sus consumos quedan en las ventas sin su nombre. ¿Seguimos?`)) return;
    try { const r = await appApi<{ detail: string }>(`/customers/${c.id}`, { method: "DELETE" }); onOk(r.detail); onDeleted(); } catch (e) { onFail(e); }
  }

  return (
    <div className="r3-panel">
      <div className="r3-sub"><h2 style={{ margin: 0, color: "var(--rs-ink)", fontSize: 20 }}>{c.name}</h2>{canEdit && <button className="r2-mini" onClick={onEdit}>Editar</button>}</div>
      <div className="r3-chips">
        <Pill tone={LEVEL_TONE[c.level]}>{LEVEL_LABEL[c.level]}</Pill>
        {c.no_show_flag && <Pill tone="red">No vino a {c.no_show_count} reservas</Pill>}
        {c.balance > 0 && <Pill tone="orange">Debe {money(c.balance)}</Pill>}
        {c.birthday_in_days !== null && <Pill tone="violet">{c.birthday_in_days === 0 ? "Cumple hoy" : `Cumple en ${c.birthday_in_days} días`}</Pill>}
        {c.tags.map((t) => <Pill key={t} tone="gray">{t}</Pill>)}
      </div>
      {c.has_allergy && <div className="rs-note rs-note-warn"><strong>Alergia o celiaquía:</strong> {c.allergy_notes}<br /><small>Dato de salud, guardado con su consentimiento{c.allergy_consent_at ? ` el ${shortDate(c.allergy_consent_at)}` : ""}.</small></div>}
      <div className="r3-kv">
        {c.phone && <span><a href={`tel:${c.phone}`} className="rs-link">{c.phone}</a></span>}
        {c.email && <span>{c.email}</span>}
        {c.birthday && <small>Cumpleaños: {shortDate(c.birthday)}</small>}
        {c.notes && <small>{c.notes}</small>}
      </div>
      <div className="r3-kpis">
        <div className="r3-kpi"><small>Visitas</small><b>{c.visits}</b><span>{c.next_level ? `${c.visits_to_next} para ser ${LEVEL_LABEL[c.next_level].toLowerCase()}` : "Nivel máximo"}</span></div>
        <div className="r3-kpi"><small>Gastó</small><b>{money(c.spent)}</b><span>Ticket {money(c.avg_ticket)}</span></div>
      </div>
      {c.favorites && c.favorites.length > 0 && <div><h3>Lo que más pide</h3><p className="r2-muted">{c.favorites.map((f) => `${f.name} (${f.qty})`).join(" · ")}</p></div>}

      <div><h3>Direcciones</h3>
        {(c.addresses || []).length === 0 && <p className="r2-muted">Sin direcciones guardadas.</p>}
        {(c.addresses || []).map((a) => <div key={a.id} className="r3-sub"><span style={{ color: "var(--rs-ink)" }}>{a.label ? <b>{a.label}: </b> : null}{a.address}{a.zone_name ? ` · ${a.zone_name}` : ""}</span>{canEdit && <button className="r2-mini is-danger" onClick={() => delAddress(a.id)}>Quitar</button>}</div>)}
        {canEdit && <div className="r3-form" style={{ marginTop: 8 }}>
          <Field label="Nombre"><input value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} placeholder="Casa, oficina" /></Field>
          <Field label="Dirección"><input value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} /></Field>
          <div className="form-group" style={{ alignSelf: "end" }}><button className="secondary-button" onClick={addAddress} disabled={addr.address.trim().length < 3}>Agregar</button></div></div>}
      </div>

      <div><div className="r3-sub"><h3>Cuenta corriente</h3>{canEdit && <button className="r2-mini" onClick={() => setShowLed(!showLed)}>{showLed ? "Cerrar" : "Registrar movimiento"}</button>}</div>
        <p className="r2-muted">Saldo: <b>{money(c.balance)}</b>{c.balance > 0 ? " (debe)" : ""}</p>
        {showLed && <div className="r3-form">
          <Field label="Tipo"><select value={led.kind} onChange={(e) => setLed({ ...led, kind: e.target.value })}><option value="PAGO">Pago (entrega plata)</option><option value="CARGO">Cargo (queda debiendo)</option></select></Field>
          <Field label="Importe ($)"><input inputMode="decimal" value={led.amount} onChange={(e) => setLed({ ...led, amount: e.target.value })} /></Field>
          {led.kind === "PAGO" && <Field label="Cómo paga"><select value={led.method} onChange={(e) => setLed({ ...led, method: e.target.value })}><option value="EFECTIVO">Efectivo (entra a la caja)</option><option value="OTRO">Otro medio</option></select></Field>}
          {led.kind === "CARGO" && !isBoss && <Field label="PIN de un encargado"><input type="password" inputMode="numeric" value={led.pin} onChange={(e) => setLed({ ...led, pin: e.target.value })} /></Field>}
          <Field label="Nota"><input value={led.note} onChange={(e) => setLed({ ...led, note: e.target.value })} /></Field>
          <div className="form-group" style={{ alignSelf: "end" }}><button className="primary-button" onClick={saveLedger}>Registrar</button></div></div>}
        {(c.ledger || []).map((e) => <div key={e.id} className="r3-sub"><span style={{ color: "var(--rs-ink)" }}>{e.kind === "CARGO" ? "Cargo" : "Pago"}{e.note ? ` · ${e.note}` : ""}<small className="r2-muted"> {dateTime(e.created_at)}</small></span><b className="r3-money" style={{ color: "var(--rs-ink)" }}>{e.kind === "CARGO" ? "+" : "−"}{money(e.amount)}</b></div>)}
      </div>

      {c.history && c.history.length > 0 && <div><h3>Últimos consumos</h3>
        {c.history.slice(0, 8).map((h) => <div key={h.id} className="r3-sub"><span style={{ color: "var(--rs-ink)", fontSize: 13 }}>{h.closed_at ? shortDate(h.closed_at) : ""} · {h.items || `#${h.number}`}</span><b className="r3-money" style={{ color: "var(--rs-ink)" }}>{money(h.total)}</b></div>)}</div>}

      {isBoss && <div className="r2-btn-row"><button className="rs-danger-button" onClick={erase}>Eliminar sus datos personales (Ley 25.326)</button></div>}
    </div>
  );
}
