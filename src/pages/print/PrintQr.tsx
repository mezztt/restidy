// QR de todas las mesas para imprimir y pegar
import { useEffect, useState } from "react";
import { appApi } from "../../config";
import { Loading } from "../../components/ui";
import QrCode, { fullUrl } from "../../components/r1/QrCode";
import "../../r1.css";
import { useLightPage } from "./usePrintPage";

interface Row { id: number; name: string; area_name: string | null; url: string; enabled: boolean }

export default function PrintQr() {
  useLightPage();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [company, setCompany] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([appApi<Row[]>("/qr/tables"), appApi<{ name: string }>("/company")]).then(([r, c]) => { setRows(r); setCompany(c.name); })
      .catch((e) => setErr(e instanceof Error ? e.message : "No se pudieron cargar los QR"));
  }, []);
  if (err) return <div className="r1-print"><div className="rs-note rs-note-error">{err}</div></div>;
  if (!rows) return <div className="r1-print"><Loading /></div>;
  return (
    <div className="r1-print">
      <div className="r1-print-bar"><span style={{ color: "#111" }}>{rows.length} mesas. Cada QR abre la carta de esa mesa.</span><button className="primary-button" onClick={() => window.print()}>Imprimir</button></div>
      <div className="r1-sheet">
        {!rows.length && <p style={{ textAlign: "center" }}>Todavía no tenés mesas. Creá el plano en Configuración.</p>}
        {rows.length > 0 && !rows[0].enabled && <div className="rs-note rs-note-warn" style={{ marginBottom: 14 }}>Tu plan no incluye pedidos por QR: estos códigos no van a abrir nada hasta que lo contrates.</div>}
        <div className="r1-qr-sheet">
          {rows.map((r) => (
            <div key={r.id} className="r1-qr-card">
              <strong style={{ fontSize: 14 }}>{company}</strong>
              <QrCode text={fullUrl(r.url)} label={`QR de ${r.name}`} />
              <h3>{r.name}</h3>
              <p>{r.area_name ? `${r.area_name} · ` : ""}Escaneá para ver la carta y pedir</p>
            </div>))}
        </div>
      </div>
    </div>
  );
}
