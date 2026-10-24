import { useCallback, useEffect, useState } from "react";
import { appApi } from "../../config";
import { Loading, Seg } from "../ui";
import ItemDialog from "./ItemDialog";
import MenuPicker, { needsChoices } from "./MenuPicker";
import OrderPanel from "./OrderPanel";
import { otherWaiter, useDraftQueue } from "./hooks";
import type { ItemIn, KdsTicket, MenuData, MenuProduct, OrderData } from "./types";
import type { PrintDoc } from "../../pages/print/Ticket80";

/** Carta a un lado y cuenta al otro. Si se corta internet, lo que se carga queda en este equipo y se envía solo al volver. */
export default function Workspace({ order, channel, free, openOrders, waiters, onOrder, onFail, onOk, onPrint, onPay, onClose, defaultMenu }: {
  order: OrderData; channel: "SALON" | "MOSTRADOR";
  free?: { id: number; name: string; area: string }[]; openOrders?: { id: number; title: string }[]; waiters?: { id: number; name: string }[];
  onOrder: (o: OrderData) => void; onFail: (e: unknown) => void; onOk: (m: string) => void;
  onPrint: (docs: PrintDoc[]) => void; onPay: (o: OrderData) => void; onClose?: () => void; defaultMenu?: boolean;
}) {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState<MenuProduct | null>(null);
  const [tab, setTab] = useState<"menu" | "order">(defaultMenu && !otherWaiter(order) ? "menu" : "order");
  const readOnlyBy = otherWaiter(order);
  const closed = order.status === "PAGADO" || order.status === "ANULADO" || !!readOnlyBy;

  const loadMenu = useCallback(() => {
    appApi<MenuData>(`/salon/menu?channel=${channel}`).then((m) => { setMenu(m); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar la carta"));
  }, [channel]);
  useEffect(() => { loadMenu(); const t = window.setInterval(loadMenu, 30000); return () => window.clearInterval(t); }, [loadMenu]);

  const queue = useDraftQueue(order.id, onOrder, onFail);
  const allergyDefault = false;

  async function addItem(item: ItemIn) {
    try {
      const o = await queue.add(item);
      if (o) { onOrder(o); } else { onOk("Sin conexión: se guardó en este equipo y se envía solo"); }
    } catch (e) { onFail(e); }
  }
  function choose(p: MenuProduct) {
    if (needsChoices(p) || p.alcohol) setPick(p);
    else addItem({ product_id: p.id, variant_id: null, qty: 1, modifier_option_ids: [], combo_choices: [], course: 1, allergy_alert: false });
  }
  const printTickets = (tickets: KdsTicket[]) => onPrint(tickets.map((t) => ({ kind: "comanda" as const, ticket: t })));

  return (
    <div>
      <div className="r2-ws-tabs" style={{ marginBottom: 10 }}>
        <Seg value={tab} onChange={setTab} options={[["menu", "Carta"], ["order", `Cuenta${queue.queue.length ? ` (+${queue.queue.length})` : ""}`]]} />
      </div>
      {queue.queue.length > 0 && (
        <div className="r2-offline" role="status">
          Sin conexión: hay {queue.queue.length} plato{queue.queue.length === 1 ? "" : "s"} guardado{queue.queue.length === 1 ? "" : "s"} en este equipo. Se envían solos cuando vuelva internet.
          <button className="r2-mini" style={{ marginLeft: 8 }} onClick={() => queue.flush()}>Reintentar</button>
        </div>
      )}
      <div className="r2-ws">
        <div className={tab === "order" ? "is-hidden-m" : ""}>
          {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
          {!menu && !error ? <Loading text="Cargando la carta..." /> : menu && !closed && <MenuPicker categories={menu.categories} onPick={choose} />}
          {closed && <div className="rs-note rs-note-info">{readOnlyBy ? `Esta mesa la atiende ${readOnlyBy}: no podés agregar platos.` : "La cuenta está cerrada: no se pueden agregar platos."}</div>}
        </div>
        <div className={tab === "menu" ? "is-hidden-m" : ""}>
          <OrderPanel order={order} free={free} openOrders={openOrders} waiters={waiters} onOrder={onOrder} onFail={onFail} onOk={onOk}
            onPrintComanda={printTickets} onPrecheck={channel === "SALON" ? (o) => onPrint([{ kind: "precuenta", order: o }]) : undefined}
            onPay={onPay} onClose={onClose} onAddMore={readOnlyBy ? undefined : () => setTab("menu")} readOnlyBy={readOnlyBy} />
        </div>
      </div>
      {pick && <ItemDialog product={pick} defaultCourse={1} allergyDefault={allergyDefault} allowCourses={channel === "SALON"} alcoholNotice={menu?.alcohol_notice}
        onClose={() => setPick(null)} onAdd={(it) => { setPick(null); addItem(it); }} />}
    </div>
  );
}
