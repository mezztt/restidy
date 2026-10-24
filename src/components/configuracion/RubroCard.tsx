import { useCallback, useEffect, useState } from "react";
import { appApi } from "../../config";
import { Field } from "../ui";

interface Option { key: string; label: string; icon: string; tagline: string }
interface Counts { categories: number; stations: number; areas: number }
interface RubroInfo { rubro: string | null; label: string | null; options: Option[]; starter: { available: boolean; total: Counts; pending: Counts } }
interface StarterResult { added: Counts; skipped: string[] }
interface Notify { show: (t: string, error?: boolean) => void; fail: (e: unknown) => void }

function plural(n: number, one: string, many: string) { return `${n} ${n === 1 ? one : many}`; }

/** Configuración · tipo de negocio del local y sugerencias ya armadas (opcionales, solo agregan) */
export default function RubroCard({ show, fail }: Notify) {
  const [info, setInfo] = useState<RubroInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { appApi<RubroInfo>("/company/rubro").then(setInfo).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);

  async function changeRubro(key: string) {
    setBusy(true);
    try {
      await appApi("/company", { method: "PUT", body: { rubro: key || null } });
      show(key ? "Tipo de negocio guardado" : "Tipo de negocio quitado");
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function loadStarter() {
    if (!info?.label || !confirm(`Se van a sumar las sugerencias de ${info.label}. Lo que ya cargaste no se toca ni se duplica. ¿Seguimos?`)) return;
    setBusy(true);
    try {
      const r = await appApi<StarterResult>("/company/starter", { method: "POST" });
      const parts = [
        r.added.categories ? plural(r.added.categories, "categoría de la carta", "categorías de la carta") : "",
        r.added.stations ? plural(r.added.stations, "estación", "estaciones") : "",
        r.added.areas ? plural(r.added.areas, "sector del salón", "sectores del salón") : "",
      ].filter(Boolean);
      show(parts.length ? `Se agregaron ${parts.join(", ")}` : "No había nada nuevo para agregar");
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  if (!info) return null;
  const pend = info.starter.pending;
  const nothingNew = pend.categories + pend.stations + pend.areas === 0;
  const total = info.starter.total;
  return (
    <div className="rs-card">
      <h2>Tipo de negocio</h2>
      <p className="rs-muted">Sirve para ofrecerte sugerencias de tu actividad. No cambia los módulos que tenés contratados.</p>
      <div className="product-form">
        <Field label="Mi tipo de negocio">
          <select value={info.rubro || ""} disabled={busy} onChange={(e) => changeRubro(e.target.value)}>
            <option value="">Sin elegir</option>
            {info.options.map((o) => <option key={o.key} value={o.key}>{o.icon} {o.label}</option>)}
          </select>
        </Field>
        {info.starter.available && (
          <>
            <p className="rs-muted" style={{ margin: 0 }}>
              Las sugerencias de {info.label} traen {plural(total.categories, "categoría", "categorías")} para tu carta
              {total.stations > 0 && <>, {plural(total.stations, "estación de preparación", "estaciones de preparación")}</>}
              {total.areas > 0 && <> y {plural(total.areas, "sector del salón", "sectores del salón")}</>}.
              Después las cambiás, ordenás o borrás como quieras; los productos los cargás vos. Los medios de pago ya vienen todos cargados.
            </p>
            <button type="button" className="secondary-button" style={{ alignSelf: "flex-start" }} disabled={busy || nothingNew} onClick={loadStarter}>
              {nothingNew ? "Las sugerencias ya están cargadas" : `Cargar sugerencias de ${info.label}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
