import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, getSessionUser, OPENING_DAYS, publicLinks, dateTime } from "../../config";
import { startTour } from "../../components/tour/Tour";
import PlanoEditor from "../../components/configuracion/PlanoEditor";
import StationsCard from "../../components/configuracion/StationsCard";
import RubroCard from "../../components/configuracion/RubroCard";
import VenueDocs from "../../components/configuracion/VenueDocs";
import { BajaCard } from "../../components/ServiceCancel";
import { Field, Loading, PageHeader, Switch, Tabs, numOrNull, strOrNull, useFlash } from "../../components/ui";

interface Company { name: string; slug: string | null; venue_type: string | null; cuit: string | null; email: string | null; phone: string | null; address: string | null; city: string | null }
interface Settings {
  opening_hours: Record<string, string[][]>; iva_pct: number;
  tip_enabled: boolean; tip_default_pct: number; tip_options: number[];
  cover_charge_enabled: boolean; cover_charge_amount: number; cover_charge_text: string | null; ticket_footer: string | null;
  allow_qr_orders: boolean; qr_order_mode: "CON_MESA_ABIERTA" | "LIBRE"; prep_time_min: number; delivery_enabled: boolean; takeaway_enabled: boolean;
  mp_access_token: string; mp_configured: boolean; mp_public_key: string | null;
  require_void_reason: boolean; blind_cash_close: boolean; discount_pin_pct: number; void_alert_amount: number;
  food_cost_green_pct: number; food_cost_amber_pct: number; complaints_book_reminder: boolean;
}
interface ConsumerReq { id: number; kind: string; code: string; customer_name: string; contact: string; reference: string | null; detail: string | null; status: string; created_at: string }

type Tab = "local" | "propina" | "pedidos" | "mp" | "controles" | "plano" | "venc" | "ayuda";

/** "12:00-15:00, 20:00-00:00" <-> [["12:00","15:00"],["20:00","00:00"]] */
const hoursToText = (v: string[][] | undefined) => (v || []).map(([a, b]) => `${a}-${b}`).join(", ");
function textToHours(t: string): string[][] {
  return t.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.split("-").map((y) => y.trim())).filter((p) => p.length === 2 && /^\d{1,2}:\d{2}$/.test(p[0]) && /^\d{1,2}:\d{2}$/.test(p[1]))
    .map(([a, b]) => [a.padStart(5, "0"), b.padStart(5, "0")]);
}

function Configuracion() {
  const user = getSessionUser();
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>("local");
  const [company, setCompany] = useState<Company | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [hoursText, setHoursText] = useState<Record<string, string>>({});
  const [tipsText, setTipsText] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [pedidos, setPedidos] = useState<ConsumerReq[]>([]);

  const applySettings = useCallback((d: Settings) => {
    setS(d);
    setHoursText(Object.fromEntries(OPENING_DAYS.map(([k]) => [k, hoursToText(d.opening_hours?.[k])])));
    setTipsText((d.tip_options || []).join(", "));
  }, []);

  useEffect(() => {
    appApi<Company>("/company").then(setCompany).catch(fail);
    appApi<Settings>("/settings").then(applySettings).catch(fail);
    appApi<ConsumerReq[]>("/consumer-requests").then(setPedidos).catch(() => {});
  }, [applySettings, fail]);

  async function saveCompany() {
    if (!company) return;
    try {
      setCompany(await appApi<Company>("/company", { method: "PUT", body: {
        name: company.name, venue_type: strOrNull(company.venue_type), cuit: strOrNull(company.cuit), email: strOrNull(company.email),
        phone: strOrNull(company.phone), address: strOrNull(company.address), city: strOrNull(company.city),
      } }));
      show("Datos guardados");
    } catch (e) { fail(e); }
  }
  async function saveSettings(patch: Partial<Settings> & Record<string, unknown>, message = "Configuración guardada") {
    try { applySettings(await appApi<Settings>("/settings", { method: "PUT", body: patch })); show(message); }
    catch (e) { fail(e); }
  }

  if (!company || !s) return <Loading />;
  const setC = (k: keyof Company, v: string) => setCompany({ ...company, [k]: v });
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const links = publicLinks(company.slug);
  const webs: [string, string, string][] = [
    ["web_carta", "Carta digital", links.carta], ["web_reservas", "Reservas online", links.reservas], ["web_pedidos", "Pedidos online", links.pedidos],
  ];

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONFIGURACIÓN" title="Configuración" subtitle="Datos del local, propina, pedidos, Mercado Pago y ayuda." />
      <Tabs<Tab> value={tab} onChange={setTab} options={[
        ["local", "Local"], ["propina", "Propina y cubierto"], ["pedidos", "Pedidos y QR"], ["mp", "Mercado Pago"],
        ["controles", "Controles"], ["plano", "Plano y estaciones"], ["venc", "Vencimientos"], ["ayuda", "Ayuda y baja"],
      ]} />

      {tab === "local" && (
        <div className="rs-grid-2">
          <div className="rs-card">
            <h2>Datos del local</h2>
            <p className="rs-muted">Salen en los tickets, la carta digital y las páginas públicas.</p>
            <div className="product-form">
              <Field label="Nombre"><input value={company.name} onChange={(e) => setC("name", e.target.value)} /></Field>
              <div className="form-row">
                <Field label="Tipo de local"><input value={company.venue_type || ""} placeholder="Restaurante, bar, cafetería…" onChange={(e) => setC("venue_type", e.target.value)} /></Field>
                <Field label="CUIT"><input value={company.cuit || ""} onChange={(e) => setC("cuit", e.target.value)} /></Field>
              </div>
              <div className="form-row">
                <Field label="Teléfono"><input value={company.phone || ""} onChange={(e) => setC("phone", e.target.value)} /></Field>
                <Field label="Email"><input value={company.email || ""} onChange={(e) => setC("email", e.target.value)} /></Field>
              </div>
              <div className="form-row">
                <Field label="Dirección"><input value={company.address || ""} onChange={(e) => setC("address", e.target.value)} /></Field>
                <Field label="Localidad"><input value={company.city || ""} onChange={(e) => setC("city", e.target.value)} /></Field>
              </div>
              <button className="primary-button" onClick={saveCompany} style={{ alignSelf: "flex-start" }}>Guardar datos</button>
            </div>
          </div>
          {user?.role === "ADMINISTRADOR" && <RubroCard show={show} fail={fail} />}
          <div className="rs-card">
            <h2>Horarios de atención</h2>
            <p className="rs-muted">Por día, uno o más tramos separados por coma. Ejemplo: 12:00-15:00, 20:00-00:00. Vacío = cerrado.</p>
            <div className="product-form">
              {OPENING_DAYS.map(([k, label]) => (
                <Field key={k} label={label}><input value={hoursText[k] || ""} placeholder="Cerrado" onChange={(e) => setHoursText({ ...hoursText, [k]: e.target.value })} /></Field>
              ))}
              <Field label="IVA para calcular el costo de los platos (%)" hint="Si el local es monotributista, poné 0."><input inputMode="decimal" value={s.iva_pct} onChange={(e) => set("iva_pct", numOrNull(e.target.value) ?? 0)} /></Field>
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ opening_hours: Object.fromEntries(OPENING_DAYS.map(([k]) => [k, textToHours(hoursText[k] || "")] as [string, string[][]]).filter(([, v]) => v.length)), iva_pct: s.iva_pct }, "Horarios guardados")}>Guardar horarios</button>
            </div>
          </div>
        </div>
      )}

      {tab === "propina" && (
        <div className="rs-grid-2">
          <div className="rs-card">
            <h2>Propina</h2>
            <p className="rs-muted">La propina es siempre voluntaria, va en una línea aparte y no suma al total de la cuenta ni a las ventas.</p>
            <div className="product-form">
              <Switch on={s.tip_enabled} onChange={(v) => set("tip_enabled", v)} label="Sugerir propina al cobrar" hint="El cliente puede dejar 0." />
              <div className="form-row">
                <Field label="Propina sugerida (%)"><input inputMode="decimal" value={s.tip_default_pct} onChange={(e) => set("tip_default_pct", numOrNull(e.target.value) ?? 0)} /></Field>
                <Field label="Opciones al cobrar (%)" hint="Separadas por coma."><input value={tipsText} onChange={(e) => setTipsText(e.target.value)} /></Field>
              </div>
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ tip_enabled: s.tip_enabled, tip_default_pct: s.tip_default_pct, tip_options: tipsText.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100) }, "Propina guardada")}>Guardar propina</button>
            </div>
          </div>
          <div className="rs-card">
            <h2>Cubierto</h2>
            <p className="rs-muted">Viene apagado. Si lo activás tenés que explicar qué incluye: se muestra en la carta y el cajero puede quitarlo con un toque.</p>
            <div className="product-form">
              <Switch on={s.cover_charge_enabled} onChange={(v) => set("cover_charge_enabled", v)} label="Cobrar cubierto" />
              {s.cover_charge_enabled && (<>
                <Field label="Importe por comensal ($)"><input inputMode="decimal" value={s.cover_charge_amount} onChange={(e) => set("cover_charge_amount", numOrNull(e.target.value) ?? 0)} /></Field>
                <Field label="Qué incluye" hint="Obligatorio. Ejemplo: incluye pan y pastas."><input value={s.cover_charge_text || ""} onChange={(e) => set("cover_charge_text", e.target.value)} /></Field>
              </>)}
              <Field label="Mensaje al pie del ticket" hint="Los tickets dicen siempre «Documento no válido como factura»."><input value={s.ticket_footer || ""} onChange={(e) => set("ticket_footer", e.target.value)} /></Field>
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ cover_charge_enabled: s.cover_charge_enabled, cover_charge_amount: s.cover_charge_amount, cover_charge_text: strOrNull(s.cover_charge_text) ?? "", ticket_footer: strOrNull(s.ticket_footer) ?? "" }, "Cubierto guardado")}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {tab === "pedidos" && (
        <div className="rs-card">
          <h2>Pedidos y QR de las mesas</h2>
          <p className="rs-muted">Todo pedido que llega por QR o por la web espera que un mozo lo confirme antes de pasar a cocina.</p>
          <div className="product-form">
            <Switch on={s.allow_qr_orders} onChange={(v) => set("allow_qr_orders", v)} label="Permitir pedir desde la mesa con el QR" />
            <Field label="Cómo se abre la mesa" hint="Recomendado: solo si el mozo ya abrió la mesa.">
              <select value={s.qr_order_mode} onChange={(e) => set("qr_order_mode", e.target.value as Settings["qr_order_mode"])}>
                <option value="CON_MESA_ABIERTA">Solo si el mozo abrió la mesa</option>
                <option value="LIBRE">El primer pedido abre la mesa</option>
              </select>
            </Field>
            <Field label="Tiempo de preparación (minutos)" hint="Los pedidos de cocina cambian de color cuando pasan este tiempo."><input inputMode="numeric" value={s.prep_time_min} onChange={(e) => set("prep_time_min", numOrNull(e.target.value) ?? 20)} /></Field>
            <Switch on={s.takeaway_enabled} onChange={(v) => set("takeaway_enabled", v)} label="Aceptar pedidos para retirar (take-away)" />
            <Switch on={s.delivery_enabled} onChange={(v) => set("delivery_enabled", v)} label="Aceptar pedidos a domicilio (delivery propio)" />
            <button className="primary-button" style={{ alignSelf: "flex-start" }}
              onClick={() => saveSettings({ allow_qr_orders: s.allow_qr_orders, qr_order_mode: s.qr_order_mode, prep_time_min: s.prep_time_min, takeaway_enabled: s.takeaway_enabled, delivery_enabled: s.delivery_enabled })}>Guardar</button>
          </div>
        </div>
      )}

      {tab === "mp" && (
        <div className="rs-card">
          <h2>Mercado Pago</h2>
          <p className="rs-muted">Cargá las credenciales de tu cuenta: la plata de los pedidos online y de las señas va directo a vos. Mercado Pago cobra sus comisiones; Restidy no cobra nada extra.</p>
          <div className="product-form">
            <Field label="Access Token" hint={s.mp_configured ? `Conectado (${s.mp_access_token}). Pegá uno nuevo para cambiarlo.` : "Lo encontrás en Mercado Pago → Tu negocio → Credenciales."}>
              <input type="password" autoComplete="off" value={mpToken} placeholder={s.mp_configured ? s.mp_access_token : "APP_USR-…"} onChange={(e) => setMpToken(e.target.value)} />
            </Field>
            <Field label="Public Key (opcional)"><input value={s.mp_public_key || ""} onChange={(e) => set("mp_public_key", e.target.value)} /></Field>
            <div className="rs-row">
              <button className="primary-button" disabled={!mpToken && !s.mp_public_key}
                onClick={() => { saveSettings({ ...(mpToken ? { mp_access_token: mpToken } : {}), mp_public_key: s.mp_public_key ?? "" }, "Mercado Pago guardado"); setMpToken(""); }}>Guardar</button>
              {s.mp_configured && <button className="secondary-button" onClick={() => saveSettings({ mp_access_token: "" }, "Mercado Pago desconectado")}>Desconectar</button>}
            </div>
          </div>
        </div>
      )}

      {tab === "controles" && (
        <div className="rs-grid-2">
          <div className="rs-card">
            <h2>Control de caja y anulaciones</h2>
            <p className="rs-muted">Para cuidar la plata cuando no estás en el salón.</p>
            <div className="product-form">
              <Switch on={s.require_void_reason} onChange={(v) => set("require_void_reason", v)} label="Pedir motivo al anular" hint="Queda registrado con el usuario y la hora." />
              <Switch on={s.blind_cash_close} onChange={(v) => set("blind_cash_close", v)} label="Arqueo ciego" hint="El cajero cuenta la plata antes de ver cuánto debería haber." />
              <Field label="Descuentos mayores a (%) piden PIN"><input inputMode="decimal" value={s.discount_pin_pct} onChange={(e) => set("discount_pin_pct", numOrNull(e.target.value) ?? 0)} /></Field>
              <Field label="Avisarme si las anulaciones y descuentos del día superan ($)" hint="0 = sin aviso."><input inputMode="decimal" value={s.void_alert_amount} onChange={(e) => set("void_alert_amount", numOrNull(e.target.value) ?? 0)} /></Field>
            </div>
          </div>
          <div className="rs-card">
            <h2>Costos y avisos</h2>
            <p className="rs-muted">Semáforo del costo de cada plato sobre su precio sin IVA.</p>
            <div className="product-form">
              <div className="form-row">
                <Field label="Verde hasta (%)"><input inputMode="decimal" value={s.food_cost_green_pct} onChange={(e) => set("food_cost_green_pct", numOrNull(e.target.value) ?? 0)} /></Field>
                <Field label="Ámbar hasta (%)"><input inputMode="decimal" value={s.food_cost_amber_pct} onChange={(e) => set("food_cost_amber_pct", numOrNull(e.target.value) ?? 0)} /></Field>
              </div>
              <Switch on={s.complaints_book_reminder} onChange={(v) => set("complaints_book_reminder", v)} label="Recordarme el libro de quejas"
                hint="Aviso opcional: el libro foliado y rubricado se gestiona ante Defensa del Consumidor o el municipio; confirmá si corresponde renovarlo." />
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ require_void_reason: s.require_void_reason, blind_cash_close: s.blind_cash_close, discount_pin_pct: s.discount_pin_pct, void_alert_amount: s.void_alert_amount, food_cost_green_pct: s.food_cost_green_pct, food_cost_amber_pct: s.food_cost_amber_pct, complaints_book_reminder: s.complaints_book_reminder })}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {tab === "plano" && <div className="rs-stack"><PlanoEditor show={show} fail={fail} /><StationsCard show={show} fail={fail} /></div>}
      {tab === "venc" && <VenueDocs show={show} fail={fail} />}

      {tab === "ayuda" && (
        <div className="rs-grid-2">
          <div className="rs-card" data-tour="config-tour">
            <h2>¿Cómo funcionamos?</h2>
            <p className="rs-muted">Volvé a ver el recorrido por el sistema.</p>
            <button className="primary-button" onClick={startTour}>¿Cómo funcionamos?</button>
          </div>
          <div className="rs-card">
            <h2>Tus páginas públicas</h2>
            <p className="rs-muted">Links para compartir con tus clientes (o imprimir como QR).</p>
            {webs.filter(([m]) => canAccess(user, m)).length === 0 ? <p className="rs-muted">Tu plan no incluye páginas públicas todavía.</p> : (
              <div className="product-form">
                {webs.filter(([m]) => canAccess(user, m)).map(([m, label, url]) => (
                  <div key={m} className="rs-link-box"><div><strong>{label}</strong><br /><code>{url}</code></div>
                    <button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(url); show("Link copiado"); }}>Copiar</button></div>
                ))}
              </div>
            )}
          </div>
          {user?.role === "ADMINISTRADOR" && <BajaCard />}
          <div className="rs-card">
            <h2>Bajas y arrepentimientos de tus clientes</h2>
            <p className="rs-muted">Los comensales pueden pedirlos desde tus webs públicas (carta, reservas y pedidos). Cada pedido tiene fecha, hora y código; respondeles por el contacto que dejaron.</p>
            {pedidos.length === 0 ? <p className="rs-muted">Todavía no hay pedidos.</p> : (
              <ul className="rs-list">{pedidos.map((r) => (
                <li key={r.id}><div className="rs-list-main"><strong>{r.kind === "BAJA" ? "Baja" : "Arrepentimiento"} · {r.customer_name} · Código {r.code}</strong>
                  <small>{dateTime(r.created_at)} · {r.contact}{r.reference ? ` · Ref. ${r.reference}` : ""}{r.detail ? ` · ${r.detail}` : ""} · {r.status === "ATENDIDA" ? "Atendido" : "Pendiente"}</small></div>
                  {r.status !== "ATENDIDA" && <button className="secondary-button" onClick={async () => { try { const u = await appApi<ConsumerReq>(`/consumer-requests/${r.id}/attend`, { method: "POST" }); setPedidos((l) => l.map((x) => x.id === u.id ? u : x)); } catch (e) { fail(e); } }}>Marcar atendido</button>}
                </li>))}</ul>
            )}
          </div>
          <div className="rs-card">
            <h2>Importante</h2>
            <p className="rs-muted">Restidy no emite comprobantes fiscales: todo ticket, precuenta y resumen dice «Documento no válido como factura». Facturás con tu sistema habitual de ARCA y podés anotar el número del comprobante en cada cobro.</p>
            <p className="rs-muted" style={{ marginTop: 8 }}>La carta y los alérgenos los carga el local; Restidy no certifica opciones sin TACC ni libres de gluten.</p>
          </div>
        </div>
      )}
      {flash}
    </section>
  );
}

export default Configuracion;
