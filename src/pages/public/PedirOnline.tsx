import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { publicApi, money } from "../../config";
import { AllergyBlock, Consent, Shell } from "../../components/public/Shell";
import { CartList, LineDialog, needsChoices, useCart } from "../../components/r3/kit";
import { toPayload, unitPrice } from "../../components/r3/types";
import type { MenuData, MenuProduct, Venue } from "../../components/r3/types";
import { MenuFilters, ProductRow } from "./Carta";

interface Options extends MenuData {
  venue: Venue; open_now: boolean | null; prep_time_min: number; delivery: boolean; takeaway: boolean; online_payment: boolean;
  zones: { id: number; name: string; fee: number; min_order: number; est_minutes: number }[];
}

export default function PedirOnline() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const [o, setO] = useState<Options | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"DELIVERY" | "TAKEAWAY">("TAKEAWAY");
  const [zoneId, setZoneId] = useState("");
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", addrNotes: "", notes: "" });
  const [allergy, setAllergy] = useState("");
  const [aConsent, setAConsent] = useState(false);
  const [pay, setPay] = useState(false);
  const [consent, setConsent] = useState(false);
  const [dialog, setDialog] = useState<MenuProduct | null>(null);
  const [tacc, setTacc] = useState(false);
  const [vegan, setVegan] = useState(false);
  const [excl, setExcl] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const cart = useCart();

  useEffect(() => {
    publicApi<Options>(`/public/${slug}/order-options`).then((d) => { setO(d); setKind(d.takeaway ? "TAKEAWAY" : "DELIVERY"); })
      .catch((e) => setError(e instanceof Error ? e.message : "No pudimos abrir los pedidos"));
  }, [slug]);

  const zone = o?.zones.find((z) => String(z.id) === zoneId);
  const sub = cart.lines.reduce((a, l) => a + l.unit * l.qty, 0);
  const fee = kind === "DELIVERY" && zone ? zone.fee : 0;
  const categories = useMemo(() => {
    if (!o) return [];
    return o.categories.map((c) => ({ ...c, products: c.products.filter((p) => {
      if (tacc && !p.sin_tacc) return false;
      if (vegan && !p.vegan) return false;
      if (excl.length && (!p.allergens_declared || p.allergens.some((a) => excl.includes(a.code)))) return false;
      return true;
    }) })).filter((c) => c.products.length);
  }, [o, tacc, vegan, excl]);

  function add(p: MenuProduct) {
    if (needsChoices(p)) { setDialog(p); return; }
    cart.add({ key: `${p.id}||`, product_id: p.id, variant_id: null, option_ids: [], qty: 1, notes: "", name: p.name, detail: "", unit: unitPrice(p, null, []) });
  }
  const belowMin = kind === "DELIVERY" && !!zone && zone.min_order > 0 && sub < zone.min_order;
  const ready = cart.lines.length > 0 && f.name.trim().length >= 2 && f.phone.replace(/\D/g, "").length >= 6 && consent && (kind === "TAKEAWAY" || (f.address.trim().length >= 3 && !!zone && !belowMin)) && !(allergy.trim() && !aConsent) && o?.open_now !== false;

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const r = await publicApi<{ token: string; checkout_url: string | null }>(`/public/${slug}/orders`, { method: "POST", body: {
        kind, customer_name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || null, address: kind === "DELIVERY" ? f.address.trim() : null,
        address_notes: f.addrNotes.trim() || null, zone_id: kind === "DELIVERY" ? Number(zoneId) : null, items: toPayload(cart.lines), notes: f.notes.trim() || null,
        allergy_notes: allergy.trim() || null, allergy_consent: aConsent, pay_online: pay, consent } });
      if (r.checkout_url) window.location.href = r.checkout_url; else nav(`/seguimiento/${r.token}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "No pudimos enviar el pedido"); setBusy(false); }
  }

  const off = o && !o.delivery && !o.takeaway;
  return (
    <Shell title="Pedir online" venue={o?.venue || null} heading="Pedí online" intro={o ? `Tu pedido tarda unos ${o.prep_time_min} minutos en prepararse.` : undefined} error={error}
      bar={o && cart.lines.length > 0 ? <div className="r3-bar"><b>{money(sub + fee)}</b><a className="pb-btn" href="#tu-pedido">Ver mi pedido</a></div> : undefined}>
      {o && off && <div className="pb-card"><div className="pb-soon"><b>Por ahora no tomamos pedidos online</b>Llamanos{o.venue.phone ? ` al ${o.venue.phone}` : ""}.</div></div>}
      {o && !off && (
        <>
          {o.open_now === false && <div className="r3-pub-note">El local está cerrado en este momento. Podés mirar la carta, pero no se pueden enviar pedidos hasta que abra.</div>}
          <div className="pb-card">
            <span className="pb-step-label">Cómo lo querés</span>
            <div className="r3-pub-tools" style={{ marginBottom: 0 }}>
              {o.takeaway && <button type="button" className={`r3-pub-chip ${kind === "TAKEAWAY" ? "is-on" : ""}`} aria-pressed={kind === "TAKEAWAY"} onClick={() => setKind("TAKEAWAY")}>Lo retiro en el local</button>}
              {o.delivery && <button type="button" className={`r3-pub-chip ${kind === "DELIVERY" ? "is-on" : ""}`} aria-pressed={kind === "DELIVERY"} onClick={() => setKind("DELIVERY")}>Que me lo lleven</button>}
            </div>
          </div>
          {o.alcohol_notice && <div className="r3-pub-notice">{o.alcohol_notice}</div>}
          <MenuFilters data={o} tacc={tacc} setTacc={setTacc} vegan={vegan} setVegan={setVegan} excl={excl} setExcl={setExcl} />
          {categories.map((c) => (
            <section key={c.id} className="pb-card r3-pub-cat"><h3>{c.name}</h3>
              {c.products.map((p) => <ProductRow key={p.id} p={p} action={p.orderable ? <div><button className="pb-btn" style={{ minHeight: 40, padding: "0 16px", fontSize: 14, marginTop: 6 }} onClick={() => add(p)}>Agregar</button></div> : undefined} />)}
            </section>
          ))}
          {categories.length === 0 && <div className="pb-card"><div className="pb-soon"><b>No hay platos para pedir</b>{tacc || vegan || excl.length ? "Probá con menos filtros." : ""}</div></div>}

          <div className="pb-card" id="tu-pedido">
            <span className="pb-step-label">Tu pedido</span>
            <CartList lines={cart.lines} onQty={cart.setQty} onRemove={cart.remove} extra={fee ? [{ label: `Envío (${zone?.name})`, amount: fee }] : []} />
          </div>
          {cart.lines.length > 0 && (
            <div className="pb-card">
              <span className="pb-step-label">Tus datos</span>
              <div className="pb-field"><label htmlFor="n">Nombre</label><input id="n" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="pb-row">
                <div className="pb-field"><label htmlFor="t">Teléfono</label><input id="t" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                <div className="pb-field"><label htmlFor="e">Email (opcional)</label><input id="e" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              </div>
              {kind === "DELIVERY" && (
                <>
                  <div className="pb-field"><label htmlFor="z">Zona de entrega</label>
                    <select id="z" value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">Elegí tu zona</option>{o.zones.map((z) => <option key={z.id} value={z.id}>{z.name} · envío {money(z.fee)}{z.min_order ? ` · mínimo ${money(z.min_order)}` : ""}</option>)}</select></div>
                  {belowMin && zone && <div className="pb-error" role="alert">Para {zone.name} el pedido mínimo es {money(zone.min_order)}. Te faltan {money(zone.min_order - sub)}.</div>}
                  <div className="pb-field"><label htmlFor="d">Dirección</label><input id="d" autoComplete="street-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Calle, número, piso" /></div>
                  <div className="pb-field"><label htmlFor="r">Referencias (opcional)</label><input id="r" maxLength={255} value={f.addrNotes} onChange={(e) => setF({ ...f, addrNotes: e.target.value })} placeholder="Timbre, entre calles..." /></div>
                </>
              )}
              <div className="pb-field"><label htmlFor="o">Aclaraciones (opcional)</label><input id="o" maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              <AllergyBlock notes={allergy} consent={aConsent} onNotes={setAllergy} onConsent={setAConsent} />
              <div className="pb-field"><label>Cómo pagás</label>
                <div className="r3-pub-tools">
                  <button type="button" className={`r3-pub-chip ${!pay ? "is-on" : ""}`} aria-pressed={!pay} onClick={() => setPay(false)}>{kind === "DELIVERY" ? "Al recibir" : "Al retirar"}</button>
                  {o.online_payment && <button type="button" className={`r3-pub-chip ${pay ? "is-on" : ""}`} aria-pressed={pay} onClick={() => setPay(true)}>Ahora con Mercado Pago</button>}
                </div>
                {pay && <small className="r3-pub-legal">Tu pedido pasa a cocina cuando Mercado Pago confirma el pago. Si no pagás en 30 minutos, se cancela.</small>}
              </div>
              <Consent checked={consent} onChange={setConsent} />
              {msg && <div className="pb-error" role="alert">{msg}</div>}
              <button className="pb-btn" disabled={!ready || busy} onClick={submit}>{busy ? "Enviando..." : pay ? `Pagar ${money(sub + fee)}` : `Enviar pedido · ${money(sub + fee)}`}</button>
              <p className="r3-pub-legal">Podés cancelar desde el seguimiento mientras el local no haya aceptado el pedido. Una vez en marcha, llamá al local.</p>
            </div>
          )}
          <p className="r3-pub-legal">{o.disclaimer}</p>
        </>
      )}
      {!o && !error && <div className="pb-card"><div className="pb-soon"><b>Cargando la carta...</b></div></div>}
      {dialog && <LineDialog product={dialog} onClose={() => setDialog(null)} onAdd={(l) => { cart.add(l); setDialog(null); }} />}
    </Shell>
  );
}
