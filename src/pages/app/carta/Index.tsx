// Carta: categorías, productos, variantes, adicionales, combos, alérgenos, precios por horario y 86 en vivo
import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, canAccess, getSessionUser } from "../../../config";
import { Loading, PageHeader, Tabs, useFlash } from "../../../components/ui";
import type { AllergenCat, Category, ModGroup, PriceRule, Product, Station } from "../../../components/carta/types";
import ProductsTab from "../../../components/carta/ProductsTab";
import GroupsTab from "../../../components/carta/GroupsTab";
import CombosTab from "../../../components/carta/CombosTab";
import RulesTab from "../../../components/carta/RulesTab";
import AllergenMatrix from "../../../components/carta/AllergenMatrix";

type Tab = "productos" | "adicionales" | "combos" | "horarios" | "alergenos";

export default function CartaIndex() {
  const user = getSessionUser();
  const canEdit = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";
  const hasStock = canAccess(user, "stock");
  const { fail, show, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("productos");
  const [cats, setCats] = useState<Category[] | null>(null);
  const [prods, setProds] = useState<Product[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [groups, setGroups] = useState<ModGroup[]>([]);
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [allergens, setAllergens] = useState<AllergenCat[]>([]);

  const load = useCallback(async () => {
    try {
      const [c, p, s, a] = await Promise.all([
        appApi<Category[]>("/categories"), appApi<Product[]>("/products"), appApi<Station[]>("/stations"), appApi<AllergenCat[]>("/allergens"),
      ]);
      setCats(c); setProds(p); setStations(s); setAllergens(a);
      if (canEdit) {
        const [g, r] = await Promise.all([appApi<ModGroup[]>("/modifier-groups"), appApi<PriceRule[]>("/price-rules")]);
        setGroups(g); setRules(r);
      }
    } catch (e) { fail(e); setCats((x) => x ?? []); }
  }, [canEdit, fail]);
  useEffect(() => { load(); }, [load]);

  const kpi = useMemo(() => {
    const active = prods.filter((p) => p.active && p.kind === "SIMPLE");
    return {
      active: active.length, out: prods.filter((p) => p.active && p.sold_out).length,
      tacc: active.filter((p) => p.sin_tacc).length,
      red: prods.filter((p) => p.active && p.cost?.light === "ROJO").length,
      noCost: prods.filter((p) => p.active && p.kind === "SIMPLE" && p.cost && p.cost.light === "SIN_COSTO").length,
      undeclared: active.filter((p) => !p.allergens_declared).length,
    };
  }, [prods]);

  if (!cats) return <Loading />;
  const tabs: [Tab, string][] = canEdit
    ? [["productos", "Productos"], ["adicionales", "Adicionales"], ["combos", "Combos"], ["horarios", "Precios por horario"], ["alergenos", "Alérgenos"]]
    : [["productos", "Productos"], ["alergenos", "Alérgenos"]];

  return (
    <div className="products-page">
      <PageHeader eyebrow="GESTIÓN" title="Carta" subtitle={canEdit ? "Lo que vendés, a qué precio y qué lleva. Lo que pausás acá deja de venderse en el salón, el QR y la web." : "Pausá un producto cuando se acaba para que nadie lo pida."} />
      <div className="rs-kpis">
        <div className="rs-kpi"><span>Productos activos</span><strong>{kpi.active}</strong><small>{cats.filter((c) => c.active).length} categorías</small></div>
        <div className={`rs-kpi ${kpi.out ? "is-warn" : ""}`}><span>Agotados ahora</span><strong>{kpi.out}</strong><small>no se pueden pedir</small></div>
        <div className="rs-kpi"><span>Opciones sin TACC</span><strong>{kpi.tacc}</strong><small>declaradas por el local</small></div>
        {hasStock && canEdit && <div className={`rs-kpi ${kpi.red ? "is-alert" : ""}`}><span>Margen en rojo</span><strong>{kpi.red}</strong><small>{kpi.noCost} sin costo cargado</small></div>}
      </div>
      {canEdit && kpi.active > 0 && kpi.tacc === 0 && (
        <div className="rs-note rs-note-warn" style={{ marginBottom: 14 }}>
          <strong>No tenés ninguna opción sin TACC.</strong> Si tenés platos aptos para celíacos, marcalos en la pestaña Alérgenos: tus clientes los pueden filtrar.
        </div>
      )}
      {canEdit && kpi.undeclared > 0 && (
        <div className="rs-note rs-note-info" style={{ marginBottom: 14 }}>
          {kpi.undeclared} {kpi.undeclared === 1 ? "producto no tiene" : "productos no tienen"} los alérgenos declarados. Quien filtra por alérgeno no los ve hasta que los declares.
        </div>
      )}
      <Tabs value={tab} options={tabs} onChange={setTab} />
      <div style={{ height: 14 }} />
      {tab === "productos" && <ProductsTab cats={cats} prods={prods} stations={stations} groups={groups} allergens={allergens} canEdit={canEdit} hasStock={hasStock} reload={load} show={show} fail={fail} />}
      {tab === "adicionales" && canEdit && <GroupsTab groups={groups} allergens={allergens} hasStock={hasStock} reload={load} show={show} fail={fail} />}
      {tab === "combos" && canEdit && <CombosTab cats={cats} prods={prods} stations={stations} reload={load} show={show} fail={fail} />}
      {tab === "horarios" && canEdit && <RulesTab rules={rules} cats={cats} prods={prods} reload={load} show={show} fail={fail} />}
      {tab === "alergenos" && <AllergenMatrix prods={prods} cats={cats} allergens={allergens} canEdit={canEdit} reload={load} show={show} fail={fail} />}
      {flash}
    </div>
  );
}
