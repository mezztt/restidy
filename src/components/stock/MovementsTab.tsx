import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime } from "../../config";
import { Field, Loading, Modal, Pill } from "../ui";
import { EmptyAction, fmtMoney, fmtQty, QtyInput } from "../r1/common";
import type { Ingredient, Movement, Notify } from "./types";
import { MOVE_LABEL } from "./types";

export default function MovementsTab({ ings, reload, show, fail }: Notify & { ings: Ingredient[]; reload: () => Promise<void> | void }) {
  const [rows, setRows] = useState<Movement[] | null>(null);
  const [kind, setKind] = useState("");
  const [days, setDays] = useState("30");
  const [open, setOpen] = useState<"MERMA" | "AJUSTE" | null>(null);
  const load = useCallback(() => appApi<Movement[]>(`/stock/movements?days=${days}${kind ? `&kind=${kind}` : ""}`).then(setRows).catch(fail), [days, kind, fail]);
  useEffect(() => { load(); }, [load]);
  const mermaValue = (rows ?? []).filter((m) => m.kind === "MERMA").reduce((s, m) => s + m.value, 0);
  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-filters">
          <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos los movimientos</option>{Object.entries(MOVE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select aria-label="Período" value={days} onChange={(e) => setDays(e.target.value)}><option value="7">Última semana</option><option value="30">Último mes</option><option value="90">Últimos 3 meses</option></select>
        </div>
        <div className="rs-row"><button className="secondary-button" onClick={() => setOpen("AJUSTE")}>Ajustar stock</button><button className="primary-button" onClick={() => setOpen("MERMA")}>Registrar merma</button></div>
      </div>
      {rows && rows.some((m) => m.kind === "MERMA") && <div className="rs-note rs-note-warn" style={{ marginBottom: 12 }}>Mermas del período: <strong>{fmtMoney(mermaValue)}</strong> a costo promedio.</div>}
      {!rows ? <Loading /> : !rows.length ? <div className="rs-card"><EmptyAction title="No hay movimientos en este período" text="Acá queda todo lo que entra y sale: compras, consumo por ventas, mermas, ajustes e inventarios." /></div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Fecha</th><th>Insumo</th><th>Tipo</th><th className="num">Cantidad</th><th className="num">Valor</th><th>Motivo</th></tr></thead>
          <tbody>{rows.map((m) => (
            <tr key={m.id}>
              <td>{dateTime(m.created_at)}<small>{m.user_name}</small></td><td><strong>{m.ingredient_name}</strong></td>
              <td><Pill tone={m.kind === "MERMA" ? "red" : m.kind === "COMPRA" ? "green" : m.kind === "CONSUMO" ? "blue" : "gray"}>{MOVE_LABEL[m.kind] || m.kind}</Pill></td>
              <td className="num">{m.qty > 0 ? "+" : ""}{fmtQty(m.qty, m.unit)}</td><td className="num">{fmtMoney(m.value)}</td><td>{m.reason || "—"}</td>
            </tr>))}</tbody>
        </table></div>)}
      {open && <MoveModal kind={open} ings={ings} onClose={() => setOpen(null)} onSaved={async () => { await load(); await reload(); }} show={show} fail={fail} />}
    </>
  );
}

function MoveModal({ kind, ings, onClose, onSaved, show, fail }: Notify & { kind: "MERMA" | "AJUSTE"; ings: Ingredient[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [ingId, setIngId] = useState("");
  const [qty, setQty] = useState<number | null>(null);
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ing = ings.find((i) => i.id === Number(ingId));
  async function save() {
    setBusy(true);
    try {
      await appApi("/stock/movements", { method: "POST", body: { ingredient_id: Number(ingId), kind, qty: kind === "MERMA" ? Math.abs(qty ?? 0) : (qty ?? 0) * sign, reason } });
      show(kind === "MERMA" ? "Merma registrada" : "Stock ajustado"); await onSaved(); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal eyebrow={kind === "MERMA" ? "MERMA" : "AJUSTE"} title={kind === "MERMA" ? "Registrar una merma" : "Ajustar stock a mano"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" onClick={save} disabled={busy || !ingId || !qty || !reason.trim()}>{busy ? "Guardando..." : "Confirmar"}</button></>}>
      <div className="rs-stack">
        <p className="rs-muted">{kind === "MERMA" ? "Mercadería que se perdió: vencimiento, rotura, error de cocina. Resta del stock y queda registrada." : "Corrige el stock cuando no coincide con lo que hay. Para contar todo usá «Inventario»."}</p>
        <Field label="Insumo"><select value={ingId} onChange={(e) => { setIngId(e.target.value); setQty(null); }}><option value="">Elegí uno</option>{ings.filter((i) => i.active).map((i) => <option key={i.id} value={i.id}>{i.name} ({fmtQty(i.stock_qty, i.unit)})</option>)}</select></Field>
        {ing && <Field label={kind === "MERMA" ? "Cantidad perdida" : "Cantidad"}>
          <div className="rs-row">
            {kind === "AJUSTE" && <div className="rs-seg"><button type="button" className={sign === 1 ? "is-on" : ""} onClick={() => setSign(1)}>Suma</button><button type="button" className={sign === -1 ? "is-on" : ""} onClick={() => setSign(-1)}>Resta</button></div>}
            <QtyInput key={ing.id} value={qty} unit={ing.unit} onChange={setQty} ariaLabel="Cantidad" />
          </div></Field>}
        <Field label="Motivo (obligatorio)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder={kind === "MERMA" ? "Se venció, se cayó, quemado..." : "Error de carga, conteo..."} /></Field>
      </div>
    </Modal>
  );
}
