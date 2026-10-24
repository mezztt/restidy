import { useCallback, useState } from "react";
import "../../../r2.css";
import { appApi, money } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash } from "../../../components/ui";
import Workspace from "../../../components/salon/Workspace";
import EightySix from "../../../components/salon/EightySix";
import CobroModal from "../../../components/caja/CobroModal";
import PrintPreview from "../../print/Ticket80";
import type { PrintDoc } from "../../print/Ticket80";
import { NETWORK_ERROR, usePoll } from "../../../components/salon/hooks";
import type { KdsTicket, OrderData } from "../../../components/salon/types";

interface Brief {
  id: number; number: number; label: string; customer_name: string | null; status: string; total: number; balance: number; minutes: number;
  summary: string; items_count: number; unsent: number; kitchen: { cooking: number; ready: number }; all_ready: boolean; delivered: boolean; ready_at: string | null;
}

export default function MostradorIndex() {
  const [rows, setRows] = useState<Brief[] | null>(null);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [paying, setPaying] = useState<OrderData | null>(null);
  const [docs, setDocs] = useState<PrintDoc[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [eighty, setEighty] = useState(false);
  const { show, fail, node } = useFlash();

  const load = useCallback(() => {
    appApi<Brief[]>("/mostrador/orders").then((r) => { setRows(r); setError(""); }).catch((e) => { if (e instanceof Error && e.message !== NETWORK_ERROR) setError(e.message); });
  }, []);
  usePoll(load, 5000);

  async function create() {
    setBusy(true);
    try {
      const o = await appApi<OrderData>("/orders", { method: "POST", body: { channel: "MOSTRADOR", covers: 1, customer_name: name.trim() || null } });
      setNaming(false); setName(""); setOrder(o); load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function open(id: number) { try { setOrder(await appApi<OrderData>(`/orders/${id}`)); } catch (e) { fail(e); } }
  async function ready(b: Brief, delivered: boolean) {
    try { await appApi(`/orders/${b.id}/ready`, { method: "POST", body: { delivered } }); show(delivered ? `${b.label} entregado` : `${b.label} listo para retirar`); load(); } catch (e) { fail(e); }
  }
  // al cobrar, lo que falte enviar sale a cocina primero
  async function startPay(o: OrderData) {
    try {
      let cur = o;
      if (o.unsent > 0) {
        const r = await appApi<{ order: OrderData; tickets: KdsTicket[] }>(`/orders/${o.id}/send`, { method: "POST", body: {} });
        cur = r.order;
        if (r.tickets.length) setDocs(r.tickets.map((t) => ({ kind: "comanda" as const, ticket: t })));
        setOrder(cur);
      }
      setPaying(cur);
    } catch (e) { fail(e); }
  }
  const sync = (o: OrderData) => { setOrder((c) => (c && c.id === o.id ? o : c)); setPaying((c) => (c && c.id === o.id ? o : c)); load(); };

  const pending = (rows || []).filter((r) => r.status !== "PAGADO");
  const done = (rows || []).filter((r) => r.status === "PAGADO");

  function card(b: Brief) {
    const preparing = b.kitchen.cooking > 0;
    return (
      <div key={b.id} className={`r2-bcard ${b.all_ready && !b.delivered ? "is-ready" : ""}`}>
        <div className="r2-bcard-top"><strong>{b.label}</strong><span className="r2-money">{money(b.total)}</span></div>
        <div className="r2-muted">{b.customer_name ? `${b.customer_name} · ` : ""}{b.summary || "Sin platos"}</div>
        <div className="r2-btn-row">
          {b.status === "PAGADO" ? <Pill tone="green">Cobrado</Pill> : <Pill tone="orange">Falta cobrar {money(b.balance)}</Pill>}
          {preparing && <Pill tone="blue">Preparando</Pill>}
          {b.all_ready && !b.delivered && <Pill tone="green">Listo para retirar</Pill>}
          {b.delivered && <Pill>Entregado</Pill>}
          <span className="r2-muted">{b.minutes} min</span>
        </div>
        <div className="r2-btn-row">
          {b.status !== "PAGADO" && <button className="primary-button r2-btn-sm" onClick={() => open(b.id)}>Abrir y cobrar</button>}
          {b.status === "PAGADO" && <button className="secondary-button r2-btn-sm" onClick={() => open(b.id)}>Ver</button>}
          {!b.delivered && b.status === "PAGADO" && <button className="secondary-button r2-btn-sm" onClick={() => ready(b, false)}>Avisar que está listo</button>}
          {!b.delivered && b.status === "PAGADO" && <button className="secondary-button r2-btn-sm" onClick={() => ready(b, true)}>Entregado</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="r2-page">
      <PageHeader eyebrow="SERVICIO" title="Mostrador" subtitle="Venta rápida y pedidos para llevar.">
        <button className="secondary-button" onClick={() => setEighty(true)}>Platos agotados (86)</button>
        <button className="primary-button" onClick={() => setNaming(true)}>Nueva venta</button>
      </PageHeader>
      {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      {!rows && !error ? <Loading text="Cargando ventas..." /> : rows && rows.length === 0 ? (
        <Empty title="Todavía no hay ventas hoy">Tocá «Nueva venta», cargá los productos y cobrá. Los pedidos con cocina aparecen acá hasta que los entregues.</Empty>
      ) : rows && (
        <>
          <section className="rs-stack"><h3>Para cobrar y entregar ({pending.length})</h3>
            {pending.length === 0 ? <div className="r2-muted">No hay ventas en curso.</div> : <div className="r2-board">{pending.map(card)}</div>}</section>
          <section className="rs-stack"><h3>Cobradas hoy ({done.length})</h3>
            {done.length === 0 ? <div className="r2-muted">Todavía no cobraste ninguna.</div> : <div className="r2-board">{done.map(card)}</div>}</section>
        </>
      )}
      {naming && (
        <Modal eyebrow="MOSTRADOR" title="Nueva venta" onClose={() => setNaming(false)}
          footer={<><button className="secondary-button" onClick={() => setNaming(false)}>Cancelar</button><button className="primary-button" disabled={busy} onClick={create}>Empezar</button></>}>
          <Field label="A nombre de (opcional)" hint="Sirve para llamar al cliente cuando el pedido esté listo."><input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} /></Field>
        </Modal>
      )}
      {order && (
        <Modal eyebrow="VENTA DE MOSTRADOR" title={order.title} size="xl" onClose={() => { setOrder(null); load(); }}>
          <Workspace order={order} channel="MOSTRADOR" onOrder={(o) => { setOrder(o); sync(o); }} onFail={fail} onOk={show} onPrint={setDocs} onPay={startPay}
            onClose={() => { setOrder(null); load(); }} defaultMenu={order.items.length === 0} />
        </Modal>
      )}
      {paying && <CobroModal order={paying} onClose={() => { setPaying(null); load(); }} onOrder={sync} onPrint={setDocs} onFail={fail} onOk={show} />}
      {eighty && <EightySix source="salon" channel="MOSTRADOR" onClose={() => setEighty(false)} onFail={fail} onOk={show} />}
      {docs.length > 0 && <PrintPreview doc={docs[0]} onClose={() => setDocs((d) => d.slice(1))} />}
      {node}
    </div>
  );
}
