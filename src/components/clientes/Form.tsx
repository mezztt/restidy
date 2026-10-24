import { useState } from "react";
import { appApi } from "../../config";
import { Field, Modal } from "../ui";
import type { Cust } from "./types";

/** Alta y edición de un cliente. Las alergias son dato de salud: solo las carga un encargado y con consentimiento. */
export default function Form({ c, isBoss, onClose, onSaved, onFail }: { c: Cust | null; isBoss: boolean; onClose: () => void; onSaved: (id: number) => void; onFail: (e: unknown) => void }) {
  const [f, setF] = useState({
    name: c?.name || "", phone: c?.phone || "", email: c?.email || "", birthday: c?.birthday || "", notes: c?.notes || "", tags: (c?.tags || []).join(", "),
    allergy: c?.allergy_notes || "", allergyConsent: !!c?.allergy_consent_at, consent: !!c?.consent_at,
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError("");
    if (f.name.trim().length < 2) return setError("Falta el nombre");
    if (f.allergy.trim() && !f.allergyConsent) return setError("Para guardar una alergia hace falta el consentimiento de la persona");
    const body: Record<string, unknown> = {
      name: f.name.trim(), phone: f.phone.trim() || null, email: f.email.trim() || null, birthday: f.birthday || null, notes: f.notes.trim() || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), consent: f.consent,
    };
    if (isBoss) { body.allergy_notes = f.allergy.trim() || null; body.allergy_consent = f.allergyConsent; }
    try {
      const r = await appApi<Cust>(c ? `/customers/${c.id}` : "/customers", { method: c ? "PUT" : "POST", body });
      onSaved(r.id);
    } catch (e) { onFail(e); }
  }
  return (
    <Modal title={c ? "Editar cliente" : "Cliente nuevo"} eyebrow="Clientes" onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="r3-detail">
        <div className="r3-form">
          <Field label="Nombre y apellido"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Teléfono"><input inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Cumpleaños"><input type="date" value={f.birthday} onChange={(e) => set("birthday", e.target.value)} /></Field>
          <Field label="Etiquetas" hint="Separadas por coma: celíaco, amigo de la casa..."><input value={f.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
          <Field label="Notas"><input value={f.notes} maxLength={500} onChange={(e) => set("notes", e.target.value)} placeholder="Mesa preferida, gustos..." /></Field>
        </div>
        <label className="r3-chk"><input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} /> La persona aceptó que guardemos sus datos</label>
        {isBoss ? (
          <div className="rs-note rs-note-warn r3-detail">
            <Field label="Alergias o celiaquía (dato de salud)" hint="Solo se guarda si la persona lo informó y dio su consentimiento. Lo ven el encargado, el mozo y la cocina."><input value={f.allergy} maxLength={500} onChange={(e) => set("allergy", e.target.value)} placeholder="Celíaco, alergia al maní..." /></Field>
            <label className="r3-chk"><input type="checkbox" checked={f.allergyConsent} onChange={(e) => set("allergyConsent", e.target.checked)} /> La persona dio su consentimiento para guardar este dato</label>
          </div>
        ) : <p className="r2-muted">Las alergias las carga un encargado, con el consentimiento de la persona.</p>}
        {error && <div className="rs-note rs-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
