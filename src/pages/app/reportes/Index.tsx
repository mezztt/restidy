import { useEffect, useState } from "react";
import "../../../r2.css";
import "../../../r3.css";
import { appApi, downloadFile, getSessionUser } from "../../../config";
import { Loading, PageHeader, Seg, Tabs, useFlash } from "../../../components/ui";
import { presetRange } from "../../../components/reportes/Parts";
import { Cash, Costs, Peak, Products, Sales, Ticket, Waiters } from "../../../components/reportes/Views";

type Tab = "ventas" | "ticket" | "platos" | "horas" | "mozos" | "costos" | "caja";
const PATH: Record<Tab, string> = { ventas: "sales", ticket: "ticket", platos: "products", horas: "peak-hours", mozos: "waiters", costos: "costs", caja: "cash" };

export default function ReportesIndex() {
  const role = getSessionUser()?.role || "";
  const cashier = role === "CAJERO";
  const [tab, setTab] = useState<Tab>(cashier ? "caja" : "ventas");
  const [range, setRange] = useState(presetRange(30));
  const [preset, setPreset] = useState("30");
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const [loaded, setLoaded] = useState<{ key: string; value: any } | null>(null);
  const [error, setError] = useState("");
  const { show, fail, node } = useFlash();

  const query = `from_date=${range.from}&to_date=${range.to}${tab === "ventas" ? `&group=${group}` : ""}`;
  const key = `${tab}|${query}`;
  const data = loaded && loaded.key === key ? loaded.value : null;   // nunca se muestra el informe de otra pestaña
  useEffect(() => {
    setError("");
    appApi(`/reports/${PATH[tab]}?${query}`).then((value) => setLoaded({ key, value })).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el informe"));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function csv() {
    try { await downloadFile(`/reports/${PATH[tab]}?${query}&format=csv`, `restidy-${PATH[tab]}-${range.from}-${range.to}.csv`); show("CSV descargado"); } catch (e) { fail(e); }
  }
  const tabs: [Tab, string][] = cashier ? [["caja", "Caja"]] : [["ventas", "Ventas"], ["ticket", "Ticket promedio"], ["platos", "Platos"], ["horas", "Horas pico"], ["mozos", "Mozos"], ["caja", "Caja"]];
  if (role === "ADMINISTRADOR") tabs.splice(5, 0, ["costos", "Costos"]);

  return (
    <div className="r3-page">
      <PageHeader eyebrow="GESTIÓN" title="Reportes" subtitle="Ventas, platos, horas pico, mozos y caja. Las propinas van siempre aparte de las ventas.">
        <button className="secondary-button" onClick={csv} disabled={!data}>Exportar CSV</button>
      </PageHeader>
      <div className="r3-tabs-wrap" data-tour="reportes-tabs"><Tabs value={tab} options={tabs} onChange={setTab} /></div>
      <div className="r3-sub">
        <div className="r3-datenav">
          <Seg value={preset} options={[["7", "7 días"], ["30", "30 días"], ["90", "90 días"]]} onChange={(v) => { setPreset(v); setRange(presetRange(Number(v))); }} />
          <input type="date" value={range.from} max={range.to} onChange={(e) => { if (e.target.value) { setPreset(""); setRange({ ...range, from: e.target.value }); } }} aria-label="Desde" />
          <input type="date" value={range.to} min={range.from} onChange={(e) => { if (e.target.value) { setPreset(""); setRange({ ...range, to: e.target.value }); } }} aria-label="Hasta" />
        </div>
        {tab === "ventas" && <Seg value={group} options={[["day", "Por día"], ["week", "Por semana"], ["month", "Por mes"]]} onChange={setGroup} />}
      </div>
      {error ? <div className="rs-note rs-note-error">{error}</div> : !data ? <Loading text="Armando el informe..." /> : (
        <>
          {tab === "ventas" && <Sales d={data} />}{tab === "ticket" && <Ticket d={data} />}{tab === "platos" && <Products d={data} />}
          {tab === "horas" && <Peak d={data} />}{tab === "mozos" && <Waiters d={data} />}{tab === "costos" && <Costs d={data} />}{tab === "caja" && <Cash d={data} />}
          <p className="r2-muted">Documento no válido como factura. Son informes de gestión internos.</p>
        </>
      )}
      {node}
    </div>
  );
}
