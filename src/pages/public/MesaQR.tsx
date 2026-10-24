import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi, money } from "../../config";
import { AllergyBlock, Shell } from "../../components/public/Shell";
import { CartList, LineDialog, needsChoices, useCart } from "../../components/r3/kit";
import { toPayload, unitPrice } from "../../components/r3/types";
import type { MenuData, MenuProduct, Venue } from "../../components/r3/types";
import { MenuFilters, ProductRow } from "./Carta";

interface TableData extends MenuData {
  venue: Venue; table: { name: string; area: string | null; seats: number }; can_order: boolean; reason: string | null;
  my_items: { name: string; qty: number; status: string; status_label: string }[]; pending_calls: string[]; tip_enabled: boolean;
}

/** Carta de una mesa (se abre con el QR). Solo se puede pedir con la mesa abierta por el mozo; el mozo confirma cada pedido. */
export default function MesaQR() {
  const { slug = "", token = "" } = useParams();
  const [data, setData] = useState<TableData | null>(null);
  const [error, setError] = useState("");
  const [tacc, setTacc] = useState(false);
  const [excl, setExcl] = useState<string[]>([]);
  const [dialog, setDialog] = useState<MenuProduct | null>(null);
  const [notes, setNotes] = useState("");
  const [allergy, setAllergy] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [msg, setMsg] = useState("");
  const [vegan, setVegan] = useState(false);
  const cart = useCart();

  const load = useCallback(() => {
    publicApi<TableData>(`/public/${slug}/table/${token}?sin_tacc=${tacc ? 1 : 0}&excluir=${excl.join(",")}`)
      .then((d) => { setData(d); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "No pudimos abrir la mesa"));
  }, [slug, token, tacc, excl]);
  useEffect(() => { load(); const t = window.setInterval(() => !document.hidden && load(), 20000); return () => window.clearInterval(t); }, [load]);

  function add(p: MenuProduct) {
    if (needsChoices(p)) { setDialog(p); return; }
    cart.add({ key: `${p.id}||`, product_id: p.id, variant_id: null, option_ids: [], qty: 1, notes: "", name: p.name, detail: "", unit: unitPrice(p, null, []) });
  }
  async function send() {
    setBusy(true); setMsg(""); setDone("");
    try {
      const r = await publicApi<{ detail: string }>(`/public/${slug}/table/${token}/order`, { method: "POST", body: { items: toPayload(cart.lines), notes: notes.trim() || null, allergy_notes: allergy.trim() || null, allergy_consent: consent } });
      setDone(r.detail); cart.clear(); setNotes(""); load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "No pudimos enviar el pedido"); } finally { setBusy(false); }
  }
  async function call(kind: "MOZO" | "CUENTA") {
    setMsg("");
    try { const r = await publicApi<{ detail: string }>(`/public/${slug}/table/${token}/call`, { method: "POST", body: { kind } }); setDone(r.detail); load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "No pudimos avisar"); }
  }
  const shown = data ? { ...data, categories: vegan ? data.categories.map((c) => ({ ...c, products: c.products.filter((p) => p.vegan) })).filter((c) => c.products.length) : data.categories } : null;
  const total = cart.lines.reduce((a, l) => a + l.unit * l.qty, 0);

  return (
    <Shell title="Tu mesa" venue={data?.venue || null} heading={data ? (/^mesa/i.test(data.table.name) ? data.table.name : `Mesa ${data.table.name}`) : "Tu mesa"} intro={data?.table.area ? data.table.area : "Carta y pedido desde el celular"}
      error={error && !data ? error : undefined}
      bar={data?.can_order && cart.lines.length > 0 ? <div className="r3-bar"><b>{cart.lines.reduce((a, l) => a + l.qty, 0)} platos · {money(total)}</b><a className="pb-btn" href="#tu-pedido">Ver mi pedido</a></div> : undefined}>
      {shown && (
        <>
          {done && <div className="r3-pub-ok" role="status">{done}</div>}
          {msg && <div className="pb-error" role="alert">{msg}</div>}
          {!shown.can_order && shown.reason && <div className="r3-pub-note">{shown.reason}</div>}
          <div className="pb-card">
            <span className="pb-step-label">Mozo</span>
            <div className="r3-pub-tools" style={{ marginBottom: 0 }}>
              <button className="pb-btn pb-btn-ghost" disabled={shown.pending_calls.includes("MOZO")} onClick={() => call("MOZO")}>{shown.pending_calls.includes("MOZO") ? "Ya avisamos al mozo" : "Llamar al mozo"}</button>
              <button className="pb-btn pb-btn-ghost" disabled={shown.pending_calls.includes("CUENTA")} onClick={() => call("CUENTA")}>{shown.pending_calls.includes("CUENTA") ? "Ya pediste la cuenta" : "Pedir la cuenta"}</button>
            </div>
          </div>
          {shown.my_items.length > 0 && (
            <div className="pb-card"><span className="pb-step-label">Lo que pidió tu mesa</span>
              {shown.my_items.map((i, k) => <div key={k} className="r3-pub-item" style={{ padding: "8px 0" }}><span style={{ color: "#2b1511" }}>{i.qty}× {i.name}</span><span className="r3-pub-allergens">{i.status_label}</span></div>)}</div>
          )}
          {shown.alcohol_notice && <div className="r3-pub-notice">{shown.alcohol_notice}</div>}
          <MenuFilters data={shown} tacc={tacc} setTacc={setTacc} vegan={vegan} setVegan={setVegan} excl={excl} setExcl={setExcl} />
          {shown.categories.map((c) => (
            <section key={c.id} className="pb-card r3-pub-cat"><h3>{c.name}</h3>
              {c.products.map((p) => <ProductRow key={p.id} p={p} action={shown.can_order && p.orderable ? <div><button className="pb-btn" style={{ minHeight: 40, padding: "0 16px", fontSize: 14, marginTop: 6 }} onClick={() => add(p)}>Agregar</button></div> : undefined} />)}
            </section>
          ))}
          {shown.can_order && (
            <div className="pb-card" id="tu-pedido">
              <span className="pb-step-label">Tu pedido</span>
              <CartList lines={cart.lines} onQty={cart.setQty} onRemove={cart.remove} />
              {cart.lines.length > 0 && (
                <>
                  <div className="pb-field" style={{ marginTop: 12 }}><label htmlFor="nota">Aclaración para la cocina (opcional)</label><input id="nota" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} /></div>
                  <AllergyBlock notes={allergy} consent={consent} onNotes={setAllergy} onConsent={setConsent} />
                  <p className="r3-pub-legal" style={{ marginBottom: 10 }}>El mozo recibe tu pedido y lo confirma antes de pasarlo a cocina. {shown.tip_enabled ? "La propina es opcional y se paga al cerrar la cuenta." : ""}</p>
                  <button className="pb-btn" disabled={busy || (!!allergy.trim() && !consent)} onClick={send}>{busy ? "Enviando..." : "Enviar pedido al mozo"}</button>
                </>
              )}
            </div>
          )}
          <p className="r3-pub-legal">{shown.disclaimer}</p>
        </>
      )}
      {!data && !error && <div className="pb-card"><div className="pb-soon"><b>Abriendo tu mesa...</b></div></div>}
      {dialog && <LineDialog product={dialog} onClose={() => setDialog(null)} onAdd={(l) => { cart.add(l); setDialog(null); }} />}
    </Shell>
  );
}
