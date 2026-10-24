import { useEffect, useMemo, useState } from "react";
import { MailCompose } from "./MailCenter";
import AppDesktop from "./AppDesktop";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  adminApi, money, plansFor, priceBreakdown, shortDate, splitList, systemStatus, publicLinks,
  CORE_MODULES, ALL_MODULES, EXTRA_MODULES, MODULE_LABELS, PAYMENT_STATUS_LABELS, ROLE_LABELS, moduleHint, moduleLabel, withDependencies, requiredBy,
} from "../../config";
import type { BillingPrices, SystemItem, PaymentItem } from "../../config";
import { Modal, PageHeader, Pill, Seg, Tabs, useFlash } from "../../components/ui";
import { RUBROS, findRubro, suggestedModules } from "../../rubros";

interface SystemUser { id: number; name: string; email: string; role: string; active: boolean }
type DetailTab = "info" | "pagos" | "usuarios" | "mail" | "app" | "seguridad";

const DEFAULT_MODULES: string[] = ["salon", "cocina", "caja"];
const VENUE_TYPES = ["Restaurante", "Bar", "Cafetería", "Parrilla", "Pizzería", "Rotisería", "Heladería", "Otro"];

const emptyForm = () => ({
  company_name: "", slug: "", venue_type: "Restaurante", rubro: "", cuit: "", email: "", phone: "", address: "", city: "",
  enabled_modules: [...DEFAULT_MODULES] as string[],
  client_price: "", payment_status: "al_dia", payment_due_date: "", billed: false, apply_iva: true, notes: "",
  admin_name: "Administrador", admin_email: "", admin_password: "",
});

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
function slugPreview(text: string) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/** Módulos del sistema: los que otro módulo necesita quedan tildados y bloqueados («incluido por…»); se cobran igual. */
function ModulePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const full = withDependencies(value);
  const option = (m: string) => {
    const by = !value.includes(m) && full.includes(m) ? requiredBy(m, value) : [];
    return (
      <label key={m} className={`rs-module-option ${full.includes(m) ? "is-on" : ""}`}>
        <input type="checkbox" checked={full.includes(m)} disabled={by.length > 0} onChange={() => onChange(toggle(value, m))} />
        <div>
          <strong>{moduleLabel(m)}</strong>
          <small>{by.length > 0 ? `Incluido por ${by.map((x) => moduleLabel(x)).join(", ")} (se cobra)` : moduleHint(m)}</small>
        </div>
      </label>
    );
  };
  return (
    <div className="rs-module-grid">
      {CORE_MODULES.map((m) => (
        <label key={m} className="rs-module-option is-core">
          <input type="checkbox" checked readOnly disabled />
          <div><strong>{MODULE_LABELS[m]}</strong><small>Incluido siempre</small></div>
        </label>
      ))}
      {ALL_MODULES.filter((m) => !EXTRA_MODULES.includes(m)).map(option)}
      {EXTRA_MODULES.map(option)}
    </div>
  );
}

/** Tipo de negocio: elegirlo tilda los módulos sugeridos (se pueden destildar o sumar a mano) */
function RubroPicker({ value, modules, onPick, onApply }: {
  value: string; modules: string[]; onPick: (key: string) => void; onApply?: (mods: string[]) => void;
}) {
  const info = findRubro(value);
  const suggested = suggestedModules(value);
  const missing = suggested.filter((m) => !withDependencies(modules).includes(m));
  return (
    <div className="form-group">
      <label htmlFor="rs-rubro-select">Tipo de negocio</label>
      <select id="rs-rubro-select" value={value} onChange={(e) => onPick(e.target.value)}>
        <option value="">Sin elegir (armo los módulos a mano)</option>
        {RUBROS.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
      </select>
      {info ? (
        <small className="rs-hint">
          Sugerido para {info.label}: {suggested.map((m) => moduleLabel(m)).join(", ")}.
          {onApply && missing.length > 0 && (
            <> <button type="button" className="rs-link" onClick={() => onApply(suggested)}>Tildar los sugeridos</button></>
          )}
        </small>
      ) : <small className="rs-hint">Al elegir uno se tildan solos los módulos que suelen servirle; después los podés cambiar.</small>}
    </div>
  );
}

/** Abono mensual sugerido según los módulos tildados (el precio que se guarda se sigue escribiendo a mano) */
function SuggestedPrice({ modules, iva, prices, onUse }: { modules: string[]; iva: boolean; prices: BillingPrices | null; onUse: (v: string) => void }) {
  if (!prices) return null;
  const p = priceBreakdown(modules, prices, iva);
  return (
    <div className="rs-price-box">
      <div><span>Abono mensual sugerido{iva ? " (con IVA)" : ""}</span><strong>{money(p.monthlyTotal)}</strong></div>
      <div><span>Pago inicial (una sola vez){iva ? " (con IVA)" : ""}</span><strong>{money(p.initialTotal)}</strong></div>
      <div><span>Trimestral (1 mes gratis)</span><strong>{money(plansFor(p.monthlyTotal).quarterly)}</strong></div>
      <div><span>Anual (2 meses gratis)</span><strong>{money(plansFor(p.monthlyTotal).annual)}</strong></div>
      <small>{p.modulesCount} módulos × {money(Number(prices.module_price))}{p.web ? ` + ${p.websCount > 1 ? `${p.websCount} webs` : "web"} ${money(p.web)}` : ""} · configuración {money(p.setup)} solo en el pago inicial</small>
      <button type="button" className="rs-link" style={{ justifySelf: "start" }} onClick={() => onUse(String(Math.round(p.monthlySubtotal * 100) / 100))}>
        Usar {money(p.monthlySubtotal)} como precio mensual
      </button>
    </div>
  );
}

function Sistemas() {
  const [params, setParams] = useSearchParams();
  const { show, fail, node: flash } = useFlash();
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activos" | "inactivos" | "locales">("activos");
  const [localIds, setLocalIds] = useState<number[]>([]);
    const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<SystemItem | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [edit, setEdit] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [closePassword, setClosePassword] = useState("");
  const [prices, setPrices] = useState<BillingPrices | null>(null);

  async function loadSystems() {
    setLoading(true);
    try {
      const list = await adminApi<SystemItem[]>("/admin/systems");
      setSystems(list);
      adminApi<{ ids: number[] }>("/admin/local-systems").then((r) => setLocalIds(r.ids)).catch(() => {});
      return list;
    } catch { return []; } finally { setLoading(false); }
  }

  useEffect(() => {
    adminApi<BillingPrices>("/admin/billing-settings").then(setPrices).catch(() => {});
    loadSystems().then((list) => {
      if (params.get("nuevo")) openForm();
      const id = Number(params.get("id"));
      const found = id ? list.find((s) => s.id === id) : undefined;
      if (found) openDetail(found);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearParams() { if (params.toString()) setParams({}, { replace: true }); }

  function openForm() { setForm(emptyForm()); setShowForm(true); }

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi("/admin/systems", {
        method: "POST",
        body: {
          ...form, slug: form.slug || null, venue_type: form.venue_type || null, rubro: form.rubro || null, cuit: form.cuit || null,
          client_price: form.client_price ? Number(form.client_price) : null, payment_due_date: form.payment_due_date || null,
        },
      });
      setShowForm(false); clearParams(); setTab("activos");
      await loadSystems();
      show(`Local creado. Ya puede entrar con ${form.admin_email}`);
    } catch (e) { fail(e); } finally { setSaving(false); }
  }

  async function openDetail(s: SystemItem) {
    setDetail(s);
    setDetailTab("info");
    setEdit({
      name: s.name, slug: s.slug || "", venue_type: s.venue_type || "", rubro: s.rubro || "", cuit: s.cuit || "", email: s.email || "", phone: s.phone || "",
      address: s.address || "", city: s.city || "", enabled_modules: splitList(s.enabled_modules),
      client_price: s.client_price ?? "", payment_status: s.payment_status,
      payment_due_date: s.payment_due_date ? s.payment_due_date.slice(0, 10) : "",
      billed: s.billed, apply_iva: s.apply_iva, notes: s.notes || "",
    });
    setNewPassword(""); setClosePassword(""); setResetUserId("");
    setPayAmount(s.client_price ? String(s.client_price) : ""); setPayNotes("");
    const [p, u] = await Promise.all([
      adminApi<PaymentItem[]>(`/admin/systems/${s.id}/payments`).catch(() => []),
      adminApi<SystemUser[]>(`/admin/systems/${s.id}/users`).catch(() => []),
    ]);
    setPayments(p); setUsers(u);
  }
  function closeDetail() { setDetail(null); clearParams(); }

  async function saveInfo() {
    if (!detail || !edit) return;
    try {
      const updated = await adminApi<SystemItem>(`/admin/systems/${detail.id}`, {
        method: "PUT",
        body: {
          ...edit, slug: edit.slug || null, venue_type: edit.venue_type || null, rubro: edit.rubro || null, cuit: edit.cuit || null,
          client_price: edit.client_price === "" ? null : Number(edit.client_price), payment_due_date: edit.payment_due_date || null,
        },
      });
      setDetail(updated);
      await loadSystems();
      show("Cambios guardados");
    } catch (e) { fail(e); }
  }

  async function addPayment() {
    if (!detail || !payAmount) return;
    try {
      await adminApi(`/admin/systems/${detail.id}/payments`, { method: "POST", body: { amount: Number(payAmount), method: payMethod, notes: payNotes || null } });
      setPayNotes("");
      setPayments(await adminApi<PaymentItem[]>(`/admin/systems/${detail.id}/payments`));
      const list = await loadSystems();
      const fresh = list.find((s) => s.id === detail.id);
      if (fresh) {
        setDetail(fresh);
        setEdit((e: any) => ({ ...e, payment_status: fresh.payment_status, payment_due_date: fresh.payment_due_date ? fresh.payment_due_date.slice(0, 10) : "" }));
      }
      show("Pago registrado");
    } catch (e) { fail(e); }
  }

  async function doSecurityReset() {
    if (!detail || !newPassword) return;
    if (!confirm("Se van a cerrar TODAS las sesiones del sistema. ¿Seguir?")) return;
    try {
      const data = await adminApi<{ detail: string }>(`/admin/systems/${detail.id}/security-reset`, {
        method: "POST", body: { new_password: newPassword, user_id: resetUserId ? Number(resetUserId) : null },
      });
      show(data.detail); setNewPassword("");
    } catch (e) { fail(e); }
  }

  async function toggleActive() {
    if (!detail || !closePassword) return;
    try {
      const data = await adminApi<{ detail: string; archived: boolean }>(`/admin/systems/${detail.id}/toggle-active`, { method: "POST", body: { password: closePassword } });
      show(`Sistema ahora: ${data.detail}`);
      setTab(data.archived ? "inactivos" : "activos");
      closeDetail();
      await loadSystems();
    } catch (e) { fail(e); }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return systems
      .filter((s) => (tab === "locales" ? localIds.includes(s.id) : localIds.includes(s.id) ? false : tab === "activos" ? !s.archived : s.archived))
      .filter((s) => !q || [s.name, s.city, s.slug, s.venue_type].some((v) => (v || "").toLowerCase().includes(q)));
  }, [systems, localIds, tab, search]);
  const counts = { activos: systems.filter((s) => !s.archived && !localIds.includes(s.id)).length, inactivos: systems.filter((s) => s.archived && !localIds.includes(s.id)).length, locales: systems.filter((s) => localIds.includes(s.id)).length };

  return (
    <section className="products-page">
      <PageHeader eyebrow="MEZZTT · RESTIDY" title="Sistemas" subtitle="Locales gastronómicos que usan Restidy, con su estado en vivo.">
        <button className="primary-button" onClick={() => openForm()}>+ Nuevo local</button>
      </PageHeader>

      <div className="rs-toolbar">
        <div className="rs-row">
          <Seg value={tab} onChange={setTab} options={[["activos", `Activos (${counts.activos})`], ["inactivos", `De baja (${counts.inactivos})`], ["locales", `Comprados · locales (${counts.locales})`]]} />
        </div>
        <input className="rs-search" placeholder="Buscar por nombre, ciudad o tipo de local…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      ) : systems.length === 0 ? (
        <div className="rs-empty"><strong>Todavía no creaste ningún sistema</strong>Creá el primero y se genera su usuario administrador.</div>
      ) : visible.length === 0 ? (
        <div className="rs-empty"><strong>No hay sistemas que coincidan</strong></div>
      ) : (
        <div className="rs-systems-grid">
          {visible.map((s) => {
            const st = localIds.includes(s.id) ? { label: "Comprado · local", tone: (s.archived ? "off" : "ok") as ReturnType<typeof systemStatus>["tone"] } : systemStatus(s);
            const mods = splitList(s.enabled_modules);
            return (
              <button key={s.id} type="button" className="rs-system-card" onClick={() => openDetail(s)}>
                <div className="rs-spread" style={{ width: "100%" }}>
                  <span className="rs-status"><span className={`rs-dot ${st.tone}`} />{st.label}</span>
                  <Pill tone="brand">{s.venue_type || "Local"}</Pill>
                </div>
                <strong>{s.name}</strong>
                <small>{[s.city, s.slug].filter(Boolean).join(" · ") || "Sin datos"}</small>
                <div className="rs-chips">{mods.map((m) => <span key={m} className="rs-chip">{moduleLabel(m)}</span>)}</div>
                <small>{localIds.includes(s.id) ? "Pago único" : s.client_price ? `${money(s.client_price)}/mes` : "Sin precio"} · {localIds.includes(s.id) ? "licencia de por vida" : s.payment_due_date ? `vence ${shortDate(s.payment_due_date)}` : PAYMENT_STATUS_LABELS[s.payment_status] || s.payment_status}{s.billed ? " · factura" : ""}</small>
                <span className="rs-edit">Ver y editar ›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============ ALTA ============ */}
      {showForm && (
        <Modal eyebrow="NUEVO SISTEMA" title="Nuevo local" onClose={() => { setShowForm(false); clearParams(); }} size="wide">
          <form onSubmit={createSystem} className="product-form">
            <h4 className="rs-form-title">Datos</h4>
            <div className="form-row">
              <div className="form-group"><label>Nombre</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required placeholder="La Parrilla del Centro" /></div>
              <div className="form-group"><label>Tipo de local</label>
                <select value={form.venue_type} onChange={(e) => setForm({ ...form, venue_type: e.target.value })}>
                  {VENUE_TYPES.map((v) => <option key={v}>{v}</option>)}
                </select></div>
            </div>
            {EXTRA_MODULES.some((m) => withDependencies(form.enabled_modules).includes(m)) && (
              <div className="form-group">
                <label>Identificador de las webs del local (slug)</label>
                <input value={form.slug} placeholder={slugPreview(form.company_name) || "mi-local"} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                <small className="rs-hint">{window.location.host}/c/{slugPreview(form.slug || form.company_name) || "…"}</small>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label>CUIT</label><input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} /></div>
              <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Email de contacto</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>

            <h4 className="rs-form-title">Módulos</h4>
            <RubroPicker value={form.rubro} modules={form.enabled_modules}
              onPick={(key) => setForm({ ...form, rubro: key, enabled_modules: key ? suggestedModules(key) : form.enabled_modules })} />
            <ModulePicker value={form.enabled_modules} onChange={(v) => setForm({ ...form, enabled_modules: v })} />

            <h4 className="rs-form-title">Abono</h4>
            <SuggestedPrice modules={form.enabled_modules} iva={form.apply_iva} prices={prices} onUse={(v) => setForm({ ...form, client_price: v })} />
            <div className="form-row">
              <div className="form-group"><label>Precio mensual</label><input type="number" min="0" value={form.client_price} onChange={(e) => setForm({ ...form, client_price: e.target.value })} /></div>
              <div className="form-group"><label>Estado de pago</label>
                <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                  <option value="al_dia">Al día</option><option value="pendiente">Pendiente</option><option value="vencido">Vencido</option>
                </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Próximo vencimiento</label><input type="date" value={form.payment_due_date} onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })} /></div>
              <div className="form-group"><label>¿Se factura? / IVA</label>
                <div className="rs-inline-checks">
                  <label><input type="checkbox" checked={form.billed} onChange={(e) => setForm({ ...form, billed: e.target.checked })} /> Se factura</label>
                  <label><input type="checkbox" checked={form.apply_iva} onChange={(e) => setForm({ ...form, apply_iva: e.target.checked })} /> Aplicar IVA 21%</label>
                </div></div>
            </div>

            <h4 className="rs-form-title">Usuario administrador</h4>
            <div className="form-row">
              <div className="form-group"><label>Nombre</label><input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required /></div>
              <div className="form-group"><label>Email (para entrar)</label><input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Contraseña inicial</label><input value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required minLength={6} /></div>
              <div className="form-group"><label>Notas internas</label><input value={form.notes} placeholder="Opcional" onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => { setShowForm(false); clearParams(); }}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "Creando..." : "Crear sistema"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ DETALLE ============ */}
      {detail && edit && (
        <Modal eyebrow={`LOCAL #${detail.id} · ALTA ${shortDate(detail.created_at)}`} title={detail.name} onClose={closeDetail} size="wide">
          <span className="rs-status" style={{ marginBottom: 12 }}><span className={`rs-dot ${systemStatus(detail).tone}`} />{systemStatus(detail).label}</span>
          <Tabs value={detailTab} onChange={setDetailTab} options={[["info", "Info y módulos"], ["pagos", `Pagos (${payments.length})`], ["usuarios", `Usuarios (${users.length})`], ["mail", "Enviar mail"], ["app", "App de escritorio"], ["seguridad", "Seguridad"]]} />

          {detailTab === "info" && (
            <div className="product-form">
              <div className="form-row">
                <div className="form-group"><label>Nombre</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div className="form-group"><label>Tipo de local</label><input value={edit.venue_type} onChange={(e) => setEdit({ ...edit, venue_type: e.target.value })} /></div>
              </div>
              {(edit.slug || EXTRA_MODULES.some((m) => withDependencies(edit.enabled_modules).includes(m))) && (
                <div className="form-group">
                  <label>Identificador de las webs del local (slug)</label>
                  <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
                  <small className="rs-hint">{publicLinks(slugPreview(edit.slug)).carta}</small>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>CUIT</label><input value={edit.cuit} onChange={(e) => setEdit({ ...edit, cuit: e.target.value })} /></div>
                <div className="form-group"><label>Ciudad</label><input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Dirección</label><input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></div>
                <div className="form-group"><label>Teléfono</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Email</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <RubroPicker value={edit.rubro} modules={edit.enabled_modules} onPick={(key) => setEdit({ ...edit, rubro: key })}
                onApply={(mods) => setEdit({ ...edit, enabled_modules: Array.from(new Set([...edit.enabled_modules, ...mods])) })} />
              <div className="form-group"><label>Módulos</label><ModulePicker value={edit.enabled_modules} onChange={(v) => setEdit({ ...edit, enabled_modules: v })} /></div>
              <SuggestedPrice modules={edit.enabled_modules} iva={edit.apply_iva} prices={prices} onUse={(v) => setEdit({ ...edit, client_price: v })} />
              <div className="form-row">
                <div className="form-group"><label>Precio mensual</label><input type="number" value={edit.client_price} onChange={(e) => setEdit({ ...edit, client_price: e.target.value })} /></div>
                <div className="form-group"><label>Estado de pago</label>
                  <select value={edit.payment_status} onChange={(e) => setEdit({ ...edit, payment_status: e.target.value })}>
                    <option value="al_dia">Al día</option><option value="pendiente">Pendiente</option><option value="vencido">Vencido</option>
                  </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Próximo vencimiento</label><input type="date" value={edit.payment_due_date} onChange={(e) => setEdit({ ...edit, payment_due_date: e.target.value })} /></div>
                <div className="form-group"><label>Facturación</label>
                  <div className="rs-inline-checks">
                    <label><input type="checkbox" checked={edit.billed} onChange={(e) => setEdit({ ...edit, billed: e.target.checked })} /> Se factura</label>
                    <label><input type="checkbox" checked={edit.apply_iva} onChange={(e) => setEdit({ ...edit, apply_iva: e.target.checked })} /> IVA 21%</label>
                  </div></div>
              </div>
              <div className="form-group"><label>Notas internas</label><input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
              <div className="modal-actions"><button className="primary-button" type="button" onClick={saveInfo}>Guardar cambios</button></div>
            </div>
          )}

          {detailTab === "pagos" && (
            <div className="product-form">
              <div className="form-row">
                <div className="form-group"><label>Monto</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
                <div className="form-group"><label>Método</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option>Transferencia</option><option>Efectivo</option><option>Mercado Pago</option><option>Otro</option>
                  </select></div>
              </div>
              <div className="form-group"><label>Notas</label><input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opcional" /></div>
              <p className="rs-hint">Al registrar el pago, queda “Al día” y el vencimiento pasa al mes siguiente.</p>
              <button className="primary-button" type="button" onClick={addPayment} style={{ alignSelf: "flex-start" }}>Registrar pago</button>
              {payments.length === 0 ? <p className="rs-muted">Sin pagos todavía.</p> : (
                <div className="rs-table-wrap" style={{ marginTop: 14 }}>
                  <table className="rs-table">
                    <thead><tr><th>Fecha</th><th className="num">Monto</th><th>Método</th><th>Notas</th></tr></thead>
                    <tbody>{payments.map((p) => <tr key={p.id}><td>{shortDate(p.payment_date)}</td><td className="num">{money(p.amount)}</td><td>{p.method || "—"}</td><td>{p.notes || "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {detailTab === "usuarios" && (
            <div>
              <div className="rs-table-wrap">
                <table className="rs-table">
                  <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead>
                  <tbody>{users.map((u) => (
                    <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{ROLE_LABELS[u.role] || u.role}</td><td>{u.active ? "Activo" : "Inactivo"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="rs-hint" style={{ marginTop: 10 }}>Los usuarios los crea cada sistema desde su módulo Usuarios. Desde acá podés resetear contraseñas en Seguridad.</p>
            </div>
          )}

          {detailTab === "mail" && <MailCompose companyId={detail.id} status={(detail as any).payment_status} dueDate={(detail as any).payment_due_date} />}
          {detailTab === "app" && <AppDesktop companyId={detail.id} users={users} />}
          {detailTab === "seguridad" && (
            <div className="product-form">
              <div className="rs-note rs-note-warn">Cierra TODAS las sesiones activas del sistema y cambia la contraseña del usuario elegido.</div>
              <div className="form-row">
                <div className="form-group"><label>Usuario</label>
                  <select value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
                    <option value="">Administrador principal</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select></div>
                <div className="form-group"><label>Contraseña nueva</label><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
              </div>
              <button className="rs-danger-button" type="button" onClick={doSecurityReset} style={{ alignSelf: "flex-start" }}>Cerrar sesiones y resetear</button>
              <hr className="rs-hr" />
              <div className="rs-note rs-note-warn">
                {detail.archived ? "Reactivar este sistema (vuelve a Activos y sus usuarios pueden entrar de nuevo)." : "Dar de baja este sistema (sus usuarios no van a poder entrar; los datos se conservan)."}
              </div>
              <div className="form-group"><label>Tu contraseña del panel</label><input type="password" value={closePassword} onChange={(e) => setClosePassword(e.target.value)} /></div>
              <button className="rs-danger-button" type="button" onClick={toggleActive} style={{ alignSelf: "flex-start" }}>{detail.archived ? "Reactivar sistema" : "Dar de baja"}</button>
            </div>
          )}
        </Modal>
      )}
      {flash}
    </section>
  );
}

export default Sistemas;
