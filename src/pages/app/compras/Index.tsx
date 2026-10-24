// Compras: proveedores, pedidos con recepción y costo, facturas y cuenta corriente
import { useCallback, useEffect, useState } from "react";
import { appApi, money } from "../../../config";
import { Loading, PageHeader, Tabs, useFlash } from "../../../components/ui";
import type { Ing, Order, Purchase, Supplier } from "../../../components/compras/types";
import SuppliersTab from "../../../components/compras/SuppliersTab";
import OrdersTab from "../../../components/compras/OrdersTab";
import PurchasesTab from "../../../components/compras/PurchasesTab";

type Tab = "proveedores" | "pedidos" | "facturas";

export default function ComprasIndex() {
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("proveedores");
  const [sup, setSup] = useState<Supplier[] | null>(null);
  const [ings, setIngs] = useState<Ing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, i, o, p] = await Promise.all([appApi<Supplier[]>("/suppliers"), appApi<Ing[]>("/ingredients"), appApi<Order[]>("/purchase-orders"), appApi<Purchase[]>("/purchases")]);
      setSup(s); setIngs(i); setOrders(o); setPurchases(p);
    } catch (e) { fail(e); setSup((x) => x ?? []); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  if (!sup) return <Loading />;
  const debt = sup.reduce((s, x) => s + x.debt, 0), overdue = sup.reduce((s, x) => s + x.overdue, 0), soon = sup.reduce((s, x) => s + x.due_soon, 0);
  const open = orders.filter((o) => o.status === "ENVIADA" || o.status === "PARCIAL").length;
  return (
    <div className="products-page">
      <PageHeader eyebrow="GESTIÓN" title="Compras" subtitle="Proveedores, pedidos, lo que recibís y lo que les debés." />
      <div className="rs-kpis">
        <div className="rs-kpi"><span>Deuda con proveedores</span><strong>{money(debt)}</strong><small>{sup.filter((s) => s.debt > 0).length} proveedores</small></div>
        <div className={`rs-kpi ${overdue ? "is-alert" : ""}`}><span>Vencido</span><strong>{money(overdue)}</strong><small>ya pasó la fecha</small></div>
        <div className={`rs-kpi ${soon ? "is-warn" : ""}`}><span>Vence en 3 días</span><strong>{money(soon)}</strong><small>para ir preparando</small></div>
        <div className="rs-kpi"><span>Pedidos en camino</span><strong>{open}</strong><small>esperando mercadería</small></div>
      </div>
      <Tabs value={tab} onChange={setTab} options={[["proveedores", "Proveedores"], ["pedidos", "Pedidos"], ["facturas", "Facturas y deuda"]]} />
      <div style={{ height: 14 }} />
      {tab === "proveedores" && <SuppliersTab suppliers={sup} ings={ings} reload={load} show={show} fail={fail} />}
      {tab === "pedidos" && <OrdersTab orders={orders} suppliers={sup} ings={ings} reload={load} show={show} fail={fail} />}
      {tab === "facturas" && <PurchasesTab purchases={purchases} suppliers={sup} ings={ings} reload={load} show={show} fail={fail} />}
      {flash}
    </div>
  );
}
