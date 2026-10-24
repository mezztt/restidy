import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, getSessionUser, money, pathFor, iconFor, moduleLabel } from "../../config";
import Icon from "../../components/Icons";
import { Loading, PageHeader, useRefreshKey } from "../../components/ui";
import Pendientes from "../../components/Pendientes";

interface Overview {
  date: string;
  sales_today: number;
  orders_paid_today: number;
  open_orders: number;
  occupied_tables: number;
  covers_open: number;
}

/** Atajos del día a día (solo los módulos que el local tiene y el rol puede abrir) */
const SHORTCUTS = ["salon", "mostrador", "caja", "cocina", "delivery", "reservas", "carta"];

function Inicio() {
  const user = getSessionUser();
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => appApi<Overview>("/dashboard").then(setData).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [refreshKey]);

  if (error) return <div className="rs-note rs-note-error">{error}</div>;
  if (!data) return <Loading />;

  const hour = new Date().getHours();
  const hello = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const shortcuts = SHORTCUTS.filter((m) => canAccess(user, m));

  return (
    <section className="products-page">
      <PageHeader eyebrow="INICIO" title={`${hello}, ${(user?.name || "").split(" ")[0]}`} subtitle={`Así viene el día en ${user?.company_name || "tu local"}.`} />

      <Pendientes />

      <div className="rs-kpis" data-tour="inicio-numeros">
        <div className="rs-kpi"><span>Ventas de hoy</span><strong>{money(data.sales_today)}</strong><small>{data.orders_paid_today} cuentas cobradas · la propina va aparte</small></div>
        <div className="rs-kpi"><span>Mesas ocupadas</span><strong>{data.occupied_tables}</strong><small>{data.covers_open} comensales en el local</small></div>
        <div className="rs-kpi"><span>Pedidos abiertos</span><strong>{data.open_orders}</strong><small>Mesas, mostrador y delivery sin cobrar</small></div>
      </div>

      {shortcuts.length > 0 && (
        <div className="rs-card" data-tour="atajos">
          <div className="rs-card-head"><div><h2>Atajos</h2><p>Lo que más se usa durante el servicio.</p></div></div>
          <div className="rs-shortcuts">
            {shortcuts.map((m) => (
              <button key={m} type="button" className="rs-shortcut" onClick={() => navigate(pathFor(m))}>
                <span aria-hidden="true"><Icon name={iconFor(m)} size={20} /></span>
                <strong>{moduleLabel(m)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default Inicio;
