import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser, ROLES, ROLE_HINTS, ROLE_LABELS } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash } from "../../components/ui";

interface UserItem { id: number; name: string; email: string; role: string; active: boolean; can_collect: boolean; station_id: number | null; has_pin: boolean }
interface StationItem { id: number; name: string }

const ROLE_TONE: Record<string, string> = { ADMINISTRADOR: "violet", ENCARGADO: "brand", MOZO: "blue", CAJERO: "green", COCINA: "orange", REPARTIDOR: "gray" };

function Usuarios() {
  const me = getSessionUser();
  const { show, fail, node: flash } = useFlash();
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [stations, setStations] = useState<StationItem[]>([]);
  const [editing, setEditing] = useState<UserItem | "new" | null>(null);

  const load = useCallback(() => { appApi<UserItem[]>("/users").then(setUsers).catch(fail); }, [fail]);
  useEffect(() => {
    load();
    // las estaciones (cocina, barra…) se cargan en Configuración; si todavía no hay, el campo no se muestra
    appApi<StationItem[]>("/stations").then(setStations).catch(() => {});
  }, [load]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="USUARIOS" title="Usuarios" subtitle="Quién entra al sistema y qué puede hacer cada uno.">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo usuario</button>
      </PageHeader>
      <div className="rs-grid-3" style={{ marginBottom: 16 }}>
        {ROLES.map((r) => (
          <div key={r} className="rs-card" style={{ padding: 14 }}><strong>{ROLE_LABELS[r]}</strong><p className="rs-muted" style={{ margin: "4px 0 0" }}>{ROLE_HINTS[r]}</p></div>
        ))}
      </div>
      {!users ? <Loading /> : users.length === 0 ? <Empty title="Sin usuarios">Creá el primero con «Nuevo usuario».</Empty> : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>PIN</th><th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="is-click" onClick={() => setEditing(u)}>
                  <td><strong>{u.name}</strong>{u.id === me?.id && <small>Vos</small>}</td>
                  <td>{u.email}</td>
                  <td><Pill tone={ROLE_TONE[u.role] || "gray"}>{ROLE_LABELS[u.role] || u.role}</Pill>{u.role === "MOZO" && u.can_collect && <small>Puede cobrar</small>}</td>
                  <td>{u.has_pin ? <Pill tone="green">Cargado</Pill> : <Pill tone="gray">Sin PIN</Pill>}</td>
                  <td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="rs-muted" style={{ marginTop: 12 }}>
        El PIN (4 a 6 números) lo usan el encargado y el dueño para autorizar anulaciones, descuentos grandes y devoluciones. Se guarda cifrado: nadie puede verlo.
      </p>
      {editing && <UserForm user={editing === "new" ? null : editing} stations={stations} isMe={editing !== "new" && editing.id === me?.id}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Usuario guardado"); }} />}
      {flash}
    </section>
  );
}

function UserForm({ user, stations, isMe, onClose, onSaved }: {
  user: UserItem | null; stations: StationItem[]; isMe: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState(user?.role || "MOZO");
  const [canCollect, setCanCollect] = useState(user?.can_collect ?? false);
  const [station, setStation] = useState(user?.station_id ? String(user.station_id) : "");
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const extra = {
        can_collect: role === "MOZO" ? canCollect : false,
        station_id: role === "COCINA" && station ? Number(station) : null,
      };
      if (user) await appApi(`/users/${user.id}`, { method: "PUT", body: { name, role, active, ...extra, password: password || null, ...(pin ? { pin } : {}) } });
      else await appApi("/users", { method: "POST", body: { name, email, password, role, ...extra, ...(pin ? { pin } : {}) } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  async function removePin() {
    if (!user) return;
    setSaving(true);
    try { await appApi(`/users/${user.id}`, { method: "PUT", body: { pin: "" } }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo quitar el PIN"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={user ? "EDITAR USUARIO" : "NUEVO USUARIO"} title={user ? user.name : "Nuevo usuario"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Email (para entrar)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
        <Field label={user ? "Contraseña nueva (opcional)" : "Contraseña"} hint="Mínimo 6 caracteres"><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HINTS[r]}</option>)}
          </select>
        </Field>
        {(role === "ENCARGADO" || role === "ADMINISTRADOR" || role === "CAJERO" || role === "MOZO") && (
          <Field label={user?.has_pin ? "PIN nuevo (opcional)" : "PIN (opcional)"} hint="4 a 6 números. Sirve para autorizar y para fichar.">
            <input inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </Field>
        )}
        {role === "MOZO" && (
          <div className="rs-inline-checks"><label><input type="checkbox" checked={canCollect} onChange={(e) => setCanCollect(e.target.checked)} /> Puede cobrar las mesas (por defecto cobra solo el cajero)</label></div>
        )}
        {role === "COCINA" && stations.length > 0 && (
          <Field label="¿De qué estación es?" hint="Es la pantalla que le aparece al entrar.">
            <select value={station} onChange={(e) => setStation(e.target.value)}>
              <option value="">Todas</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        {user && !isMe && (
          <div className="rs-inline-checks"><label><input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Desactivar (no puede entrar)</label></div>
        )}
        {user?.has_pin && <div><button type="button" className="rs-link rs-link-danger" onClick={removePin}>Quitar el PIN de este usuario</button></div>}
        {error && <div className="rs-note rs-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Usuarios;
