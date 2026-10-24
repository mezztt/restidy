import { useState } from "react";
import { appApi, money } from "../../config";
import { Field, Modal, numOrNull } from "../ui";
import { METHODS } from "./types";
import type { Notify } from "./types";

/** Pago a proveedor: sirve para una factura (path = /purchases/:id/pay) o para la cuenta (path = /suppliers/:id/pay) */
export default function PayModal({ title, path, max, onClose, onDone, show, fail }: Notify & { title: string; path: string; max: number; onClose: () => void; onDone: () => Promise<void> | void }) {
  const [amount, setAmount] = useState(String(max));
  const [method, setMethod] = useState("EFECTIVO");
  const [fromCash, setFromCash] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await appApi(path, { method: "POST", body: { amount: numOrNull(amount), method, from_cash: fromCash && method === "EFECTIVO" } });
      show("Pago registrado"); await onDone(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="PAGO A PROVEEDOR" title={title} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" onClick={go} disabled={busy || !numOrNull(amount)}>{busy ? "Registrando..." : "Registrar pago"}</button></>}>
      <div className="rs-stack">
        <p className="rs-muted">Pendiente: <strong>{money(max)}</strong>. Podés pagar una parte; el resto sigue como deuda.</p>
        <Field label="Importe"><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Medio de pago"><select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {method === "EFECTIVO" && <div className="rs-inline-checks"><label><input type="checkbox" checked={fromCash} onChange={(e) => setFromCash(e.target.checked)} /> Sale de la caja del turno abierto (queda como egreso)</label></div>}
      </div>
    </Modal>
  );
}
