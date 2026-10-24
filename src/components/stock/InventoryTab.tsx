import { Fragment, useCallback, useEffect, useState } from "react";
import { appApi, shortDate } from "../../config";
import { Loading, Pill } from "../ui";
import { ConfirmModal, EmptyAction, fmtMoney, fmtQty, QtyInput } from "../r1/common";
import type { Inventory, Notify } from "./types";

export default function InventoryTab({ reload, show, fail }: Notify & { reload: () => Promise<void> | void }) {
  const [list, setList] = useState<Inventory[] | null>(null);
  const [open, setOpen] = useState<Inventory | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => appApi<Inventory[]>("/stock/inventory").then(setList).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);
  async function start() {
    setBusy(true);
    try { const inv = await appApi<Inventory>("/stock/inventory", { method: "POST", body: {} }); setOpen(inv); await load(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function view(id: number) { try { setOpen(await appApi<Inventory>(`/stock/inventory/${id}`)); } catch (e) { fail(e); } }
  if (!list) return <Loading />;
  if (open) return <Counting inv={open} onBack={async () => { setOpen(null); await load(); await reload(); }} show={show} fail={fail} />;
  const opened = list.find((i) => i.status === "ABIERTO");
  return (
    <>
      <div className="rs-toolbar">
        <p className="rs-muted" style={{ margin: 0 }}>Contá lo que hay, cargalo y el sistema ajusta el stock y te muestra la diferencia.</p>
        {opened ? <button className="primary-button" onClick={() => view(opened.id)}>Seguir el inventario abierto</button> : <button className="primary-button" onClick={start} disabled={busy}>{busy ? "Preparando..." : "Empezar un inventario"}</button>}
      </div>
      {!list.length ? <div className="rs-card"><EmptyAction title="Todavía no hiciste inventarios" text="Conviene hacer uno cada mes, o cada semana en lo caro (carnes, bebidas)." /></div> : (
        <div className="rs-table-wrap"><table className="rs-table">
          <thead><tr><th>Fecha</th><th>Estado</th><th className="num">Contados</th><th className="num">Diferencia</th><th></th></tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id} className="is-click" onClick={() => view(i.id)}>
              <td><strong>{shortDate(i.date)}</strong>{i.notes && <small>{i.notes}</small>}</td>
              <td>{i.status === "ABIERTO" ? <Pill tone="orange">Abierto</Pill> : <Pill tone="green">Aplicado</Pill>}</td>
              <td className="num">{i.counted_count} de {i.lines_count}</td><td className="num">{fmtMoney(i.diff_value)}</td>
              <td><button className="secondary-button">Ver</button></td>
            </tr>))}</tbody>
        </table></div>)}
    </>
  );
}

function Counting({ inv, onBack, show, fail }: Notify & { inv: Inventory; onBack: () => void }) {
  const [data, setData] = useState(inv);
  const [counts, setCounts] = useState<Record<number, number | null>>(() => Object.fromEntries((inv.lines ?? []).map((l) => [l.ingredient_id, l.counted])));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<"apply" | "discard" | null>(null);
  const open = data.status === "ABIERTO";
  const lines = (data.lines ?? []).filter((l) => !q.trim() || l.name.toLowerCase().includes(q.trim().toLowerCase()));

  async function save(): Promise<Inventory | null> {
    try {
      const d = await appApi<Inventory>(`/stock/inventory/${data.id}`, { method: "PUT", body: { lines: Object.entries(counts).map(([id, counted]) => ({ ingredient_id: Number(id), counted })) } });
      setData(d); return d;
    } catch (e) { fail(e); return null; }
  }
  async function apply() {
    setBusy(true);
    const d = await save();
    if (d) {
      try { const r = await appApi<{ detail: string }>(`/stock/inventory/${data.id}/apply`, { method: "POST" }); show(r.detail); onBack(); } catch (e) { fail(e); setAsk(null); }
    }
    setBusy(false);
  }
  async function discard() {
    setBusy(true);
    try { await appApi(`/stock/inventory/${data.id}`, { method: "DELETE" }); show("Inventario descartado"); onBack(); } catch (e) { fail(e); setBusy(false); }
  }
  let lastCat = "\u0000";
  return (
    <>
      <div className="rs-toolbar">
        <div className="rs-row"><button className="secondary-button" onClick={onBack}>Volver</button><strong>Inventario del {shortDate(data.date)}</strong>{open ? <Pill tone="orange">Abierto</Pill> : <Pill tone="green">Aplicado</Pill>}</div>
        <input className="rs-search" placeholder="Buscar insumo..." aria-label="Buscar insumo" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {open && <div className="rs-note rs-note-info" style={{ marginBottom: 12 }}>Escribí lo que contaste de cada insumo. Los que dejes vacíos no se tocan. Al aplicar, el stock queda igual a lo contado.</div>}
      <div className="rs-table-wrap"><table className="rs-table">
        <thead><tr><th>Insumo</th><th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferencia</th></tr></thead>
        <tbody>{lines.map((l) => {
          const head = (l.category || "Sin rubro") !== lastCat ? (lastCat = l.category || "Sin rubro") : null;
          const c = open ? counts[l.ingredient_id] : l.counted;
          const diff = c == null ? null : c - l.expected;
          return (
            <Fragment key={l.ingredient_id}>{head && <tr><td colSpan={4} style={{ background: "var(--rs-surface-2)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{head}</td></tr>}
              <tr>
                <td><strong>{l.name}</strong></td><td className="num">{fmtQty(l.expected, l.unit)}</td>
                <td className="num">{open ? <QtyInput value={c ?? null} unit={l.unit} onChange={(v) => setCounts((x) => ({ ...x, [l.ingredient_id]: v }))} ariaLabel={`Contado de ${l.name}`} /> : c != null ? fmtQty(c, l.unit) : "—"}</td>
                <td className="num" style={diff ? { color: diff < 0 ? "var(--rs-red-text)" : "var(--rs-green-text)", fontWeight: 800 } : undefined}>{diff == null ? "—" : diff === 0 ? "Sin diferencia" : `${diff > 0 ? "+" : ""}${fmtQty(diff, l.unit)}`}</td>
              </tr></Fragment>);
        })}</tbody>
      </table></div>
      {open && (
        <div className="rs-row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <button className="rs-danger-button" onClick={() => setAsk("discard")}>Descartar</button>
          <div className="rs-row"><button className="secondary-button" onClick={async () => { setBusy(true); if (await save()) show("Conteo guardado"); setBusy(false); }} disabled={busy}>Guardar y seguir después</button>
            <button className="primary-button" onClick={() => setAsk("apply")} disabled={busy}>Aplicar al stock</button></div>
        </div>)}
      {ask === "apply" && <ConfirmModal title="Aplicar el inventario" confirmLabel="Aplicar" busy={busy} onClose={() => setAsk(null)} onConfirm={apply}>El stock de los insumos contados pasa a ser lo que cargaste. Esto no se puede deshacer, pero queda registrado en los movimientos.</ConfirmModal>}
      {ask === "discard" && <ConfirmModal title="Descartar el inventario" confirmLabel="Descartar" danger busy={busy} onClose={() => setAsk(null)} onConfirm={discard}>Se pierde lo que contaste. El stock no cambia.</ConfirmModal>}
    </>
  );
}
