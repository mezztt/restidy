// Stock: insumos, recetas con costo del plato, preparaciones, mermas y ajustes, inventario y alertas
import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, money } from "../../../config";
import { Loading, PageHeader, Tabs, useFlash } from "../../../components/ui";
import type { Ingredient, Recipe, Summary, SupplierOpt } from "../../../components/stock/types";
import IngredientsTab from "../../../components/stock/IngredientsTab";
import RecipesTab from "../../../components/stock/RecipesTab";
import PreparationsTab from "../../../components/stock/PreparationsTab";
import MovementsTab from "../../../components/stock/MovementsTab";
import InventoryTab from "../../../components/stock/InventoryTab";

type Tab = "insumos" | "recetas" | "preparaciones" | "movimientos" | "inventario";

export default function StockIndex() {
  const user = getSessionUser();
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("insumos");
  const [ings, setIngs] = useState<Ingredient[] | null>(null);
  const [preps, setPreps] = useState<Recipe[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [stateFilter, setStateFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const [i, p, s] = await Promise.all([
        appApi<Ingredient[]>("/ingredients?include_inactive=true"), appApi<Recipe[]>("/recipes"), appApi<Summary>("/stock/summary"),
      ]);
      setIngs(i); setPreps(p); setSum(s);
      if (canAccess(user, "compras")) appApi<SupplierOpt[]>("/suppliers").then(setSuppliers).catch(() => {});
    } catch (e) { fail(e); setIngs((x) => x ?? []); }
  }, [fail, user]);
  useEffect(() => { load(); }, [load]);

  if (!ings) return <Loading />;
  return (
    <div className="products-page">
      <PageHeader eyebrow="GESTIÓN" title="Stock y recetas" subtitle="Qué tenés, cuánto cuesta cada plato y qué se está acabando." />
      {sum && (
        <div className="rs-kpis">
          <div className="rs-kpi"><span>Insumos</span><strong>{sum.ingredients}</strong><small>activos</small></div>
          <div className={`rs-kpi ${sum.low + sum.negative ? "is-warn" : ""}`} style={{ cursor: "pointer" }} onClick={() => { setStateFilter("BAJO"); setTab("insumos"); }}>
            <span>Bajo el mínimo</span><strong>{sum.low}</strong><small>{sum.negative ? `${sum.negative} en negativo` : "tocá para verlos"}</small></div>
          <div className="rs-kpi"><span>Valor del stock</span><strong>{money(sum.stock_value)}</strong><small>a costo promedio</small></div>
          <div className={`rs-kpi ${sum.red ? "is-alert" : ""}`}><span>Platos en rojo</span><strong>{sum.red}</strong><small>{sum.without_recipe} sin receta</small></div>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} options={[["insumos", "Insumos"], ["recetas", "Recetas y costos"], ["preparaciones", "Preparaciones"], ["movimientos", "Mermas y movimientos"], ["inventario", "Inventario"]]} />
      <div style={{ height: 14 }} />
      {tab === "insumos" && <IngredientsTab ings={ings} suppliers={suppliers} initialState={stateFilter} reload={load} show={show} fail={fail} />}
      {tab === "recetas" && <RecipesTab ings={ings} preps={preps} reload={load} show={show} fail={fail} />}
      {tab === "preparaciones" && <PreparationsTab ings={ings} preps={preps} reload={load} show={show} fail={fail} />}
      {tab === "movimientos" && <MovementsTab ings={ings} reload={load} show={show} fail={fail} />}
      {tab === "inventario" && <InventoryTab reload={load} show={show} fail={fail} />}
      {flash}
    </div>
  );
}
