import { useState } from "react";
import { appApi } from "../../config";
import { Modal } from "../ui";
import type { Notify, Product } from "./types";

const OPTS: [string, string, { until?: string; minutes?: number }][] = [
  ["hasta", "Hasta que lo reactive", {}], ["hoy", "Por hoy (vuelve mañana a las 5:00)", { until: "HOY" }],
  ["30", "30 minutos", { minutes: 30 }], ["60", "1 hora", { minutes: 60 }], ["120", "2 horas", { minutes: 120 }],
];

export default function SoldOutModal({ product, onClose, reload, show, fail }: Notify & { product: Product; onClose: () => void; reload: () => Promise<void> | void }) {
  const [opt, setOpt] = useState("hoy");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const o = OPTS.find((x) => x[0] === opt)![2];
      await appApi(`/products/${product.id}/sold-out`, { method: "PATCH", body: { sold_out: true, ...o } });
      show(`${product.name} marcado como agotado`);
      await reload(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow="AGOTADO" title={product.name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" onClick={go} disabled={busy}>{busy ? "Guardando..." : "Marcar agotado"}</button></>}>
      <p className="rs-muted">Mientras esté agotado no se puede pedir desde el salón, el QR ni la web. ¿Hasta cuándo?</p>
      <div className="r1-chips" role="radiogroup" aria-label="Hasta cuándo">
        {OPTS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={opt === k} className={`r1-chip ${opt === k ? "is-on" : ""}`} onClick={() => setOpt(k)}>{label}</button>)}
      </div>
    </Modal>
  );
}
