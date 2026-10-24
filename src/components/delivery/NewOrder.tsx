import { useEffect, useMemo, useState } from "react";
import { appApi, money } from "../../config";
import { Field, Loading, Modal, Seg } from "../ui";
import { CartList, LineDialog, MenuPicker, needsChoices, useCart } from "../r3/kit";
import { toPayload, unitPrice } from "../r3/types";
import type { MenuData, MenuProduct } from "../r3/types";
import type { DeliveryRow, Zone } from "./types";

/** Pedido por teléfono o mostrador: cliente, dirección, zona y carta */
export default function NewOrder({ zones, onClose, onCreated, onFail }: {
  zones: Zone[]; onClose: () => void; onCreated: (d: DeliveryRow) => void; onFail: (e: unknown) => void;
}) {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [kind, setKind] = useState<"DELIVERY" | "TAKEAWAY">("DELIVERY");
  const [source, setSource] = useState<"TELEFONO" | "MANUAL">("TELEFONO");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addrNotes, setAddrNotes] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ address: string; notes: string | null; zone_id: number | null; label: string }[]>([]);
  const [dialog, setDialog] = useState<MenuProduct | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cart = useCart();
  const activeZones = zones.filter((z) => z.active);
  const zone = activeZones.find((z) => String(z.id) === zoneId);

  useEffect(() => { appApi<MenuData>("/deliveries/menu").then(setMenu).catch(onFail); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // autocompleta por teléfono
  useEffect(() => {
    if (phone.replace(/\D/g, "").length < 7) return;
    const t = window.setTimeout(() => {
      appApi<any>(`/deliveries/customer?phone=${encodeURIComponent(phone)}`).then((r) => {
        if (!r.found) { setSaved([]); return; }
        setCustomerId(r.customer_id); setSaved(r.addresses || []);
        setName((n) => n || r.name || "");
        if (r.addresses?.[0] && !address) pick(r.addresses[0]);
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(t);
  }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(a: { address: string; notes: string | null; zone_id: number | null }) {
    setAddress(a.address); setAddrNotes(a.notes || ""); if (a.zone_id) setZoneId(String(a.zone_id));
  }
  function onPick(p: MenuProduct) {
    if (needsChoices(p)) { setDialog(p); return; }
    cart.add({ key: `${p.id}||`, product_id: p.id, variant_id: null, option_ids: [], qty: 1, notes: "", name: p.name, detail: "", unit: unitPrice(p, null, []) });
  }
  const sub = useMemo(() => cart.lines.reduce((a, l) => a + l.unit * l.qty, 0), [cart.lines]);
  const fee = kind === "DELIVERY" && zone ? zone.fee : 0;

  async function save() {
    setError("");
    if (name.trim().length < 2) return setError("Falta el nombre del cliente");
    if (!cart.lines.length) return setError("Agregá al menos un plato");
    if (kind === "DELIVERY") {
      if (!address.trim()) return setError("Falta la dirección de entrega");
      if (!zone) return setError("Elegí la zona de entrega");
      if (zone.min_order > 0 && sub < zone.min_order) return setError(`La zona ${zone.name} pide un mínimo de ${money(zone.min_order)}`);
    }
    setBusy(true);
    try {
      const d = await appApi<DeliveryRow>("/deliveries", { method: "POST", body: {
        kind, source, customer_name: name.trim(), phone: phone.trim() || null, address: kind === "DELIVERY" ? address.trim() : null,
        address_notes: addrNotes.trim() || null, zone_id: kind === "DELIVERY" ? Number(zoneId) : null, customer_id: customerId,
        items: toPayload(cart.lines), notes: notes.trim() || null, accept: true,
      } });
      onCreated(d);
    } catch (e) { onFail(e); } finally { setBusy(false); }
  }

  return (
    <Modal title="Pedido nuevo" eyebrow="Delivery y take-away" onClose={onClose} size="xl"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={save}>Confirmar y mandar a cocina</button></>}>
      <div className="r3-detail">
        <div className="r2-btn-row">
          <Seg value={kind} onChange={setKind} options={[["DELIVERY", "Delivery"], ["TAKEAWAY", "Retira en el local"]]} />
          <Seg value={source} onChange={setSource} options={[["TELEFONO", "Teléfono"], ["MANUAL", "Mostrador"]]} />
        </div>
        <div className="r3-form">
          <Field label="Teléfono"><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 5555 1234" /></Field>
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" /></Field>
          {kind === "DELIVERY" && <>
            <Field label="Dirección"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, piso" list="r3-saved-addr" />
              <datalist id="r3-saved-addr">{saved.map((a, i) => <option key={i} value={a.address} />)}</datalist></Field>
            <Field label="Zona">
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="">Elegir zona</option>
                {activeZones.map((z) => <option key={z.id} value={z.id}>{z.name} · envío {money(z.fee)}</option>)}
              </select>
            </Field>
            <Field label="Referencias" wide><input value={addrNotes} onChange={(e) => setAddrNotes(e.target.value)} placeholder="Timbre, entre calles..." /></Field>
          </>}
        </div>
        {kind === "DELIVERY" && activeZones.length === 0 && <div className="rs-note rs-note-warn">Todavía no hay zonas de entrega. Cargalas en la pestaña Zonas.</div>}
        {saved.length > 1 && <div className="r2-btn-row"><span className="r2-muted">Direcciones guardadas:</span>{saved.map((a, i) => <button key={i} type="button" className="r2-mini" onClick={() => pick(a)}>{a.label || a.address}</button>)}</div>}
        {menu ? <MenuPicker categories={menu.categories} onPick={onPick} /> : <Loading text="Cargando la carta..." />}
        <h3>Pedido</h3>
        <CartList lines={cart.lines} onQty={cart.setQty} onRemove={cart.remove} extra={fee ? [{ label: `Envío (${zone?.name})`, amount: fee }] : []} />
        <Field label="Notas para cocina o el repartidor"><input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Sin sal, llevar vuelto de $10.000..." /></Field>
        {error && <div className="rs-note rs-note-error">{error}</div>}
      </div>
      {dialog && <LineDialog product={dialog} onClose={() => setDialog(null)} onAdd={(l) => { cart.add(l); setDialog(null); }} />}
    </Modal>
  );
}
