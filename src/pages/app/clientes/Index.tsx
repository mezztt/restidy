import { useCallback, useEffect, useState } from "react";
import "../../../r2.css";
import "../../../r3.css";
import { appApi, downloadCsv, getSessionUser, money } from "../../../config";
import { Empty, Loading, PageHeader, Pill, useFlash } from "../../../components/ui";
import Detail from "../../../components/clientes/Detail";
import Form from "../../../components/clientes/Form";
import { LEVEL_LABEL, LEVEL_TONE } from "../../../components/clientes/types";
import type { Cust } from "../../../components/clientes/types";

const FILTERS: [string, string][] = [["", "Todos"], ["vip", "VIP"], ["deben", "Con deuda"], ["cumple", "Cumpleaños próximos"], ["no_show", "No vinieron"]];

export default function ClientesIndex() {
  const role = getSessionUser()?.role || "";
  const isBoss = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const canEdit = isBoss || role === "CAJERO";
  const [rows, setRows] = useState<Cust[] | null>(null);
  const [meta, setMeta] = useState<{ total: number; debtors: number; birthdays_week: number } | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<Cust | null>(null);
  const [form, setForm] = useState<Cust | "new" | null>(null);
  const { show, fail, node } = useFlash();

  const load = useCallback(() => {
    appApi<{ items: Cust[]; meta: { total: number; debtors: number; birthdays_week: number } }>(`/customers?q=${encodeURIComponent(q)}&filter=${filter}`)
      .then((r) => { setRows(r.items); setMeta(r.meta); }).catch(fail);
  }, [q, filter, fail]);
  useEffect(() => { const t = window.setTimeout(load, 250); return () => window.clearTimeout(t); }, [load]);
  const open = useCallback(async (id: number) => { try { setSel(await appApi<Cust>(`/customers/${id}`)); } catch (e) { fail(e); } }, [fail]);

  function exportCsv() {
    downloadCsv("clientes.csv", ["Nombre", "Teléfono", "Email", "Nivel", "Visitas", "Gastó", "Saldo"],
      (rows || []).map((c) => [c.name, c.phone, c.email, LEVEL_LABEL[c.level], c.visits, c.spent, c.balance]));
  }

  return (
    <div className="r3-page">
      <PageHeader eyebrow="GESTIÓN" title="Clientes" subtitle="Ficha, historial de consumo, cuenta corriente y fidelización simple.">
        {rows && rows.length > 0 && isBoss && <button className="secondary-button" onClick={exportCsv}>Exportar CSV</button>}
        {canEdit && <button className="primary-button" data-tour="clientes-nuevo" onClick={() => setForm("new")}>Cliente nuevo</button>}
      </PageHeader>
      {meta && (meta.debtors > 0 || meta.birthdays_week > 0) && (
        <div className="r3-chips">{meta.debtors > 0 && <Pill tone="orange">{meta.debtors} con deuda</Pill>}{meta.birthdays_week > 0 && <Pill tone="violet">{meta.birthdays_week} cumplen años esta semana</Pill>}</div>
      )}
      <div className="r2-menu-tools"><input className="rs-search" type="search" placeholder="Buscar por nombre, teléfono o email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" /></div>
      <div className="r2-cats" role="tablist" aria-label="Filtros">{FILTERS.map(([k, l]) => <button key={k} type="button" role="tab" className={filter === k ? "is-on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="r3-split">
        <div className="r3-page" style={{ gap: 8 }}>
          {!rows ? <Loading /> : rows.length === 0 ? <Empty title={q || filter ? "No encontramos clientes con ese filtro" : "Todavía no cargaste clientes"}>{canEdit && !q && !filter ? "Se crean solos al tomar pedidos por teléfono o desde la web, o cargalos con «Cliente nuevo»." : ""}</Empty> : rows.map((c) => (
            <button key={c.id} type="button" className={`r3-cust ${sel?.id === c.id ? "is-on" : ""}`} onClick={() => open(c.id)}>
              <div><strong>{c.name}</strong><small>{c.phone || c.email || "Sin contacto"} · {c.visits} visitas · {money(c.spent)}</small></div>
              <div className="r3-chips"><Pill tone={LEVEL_TONE[c.level]}>{LEVEL_LABEL[c.level]}</Pill>{c.balance > 0 && <Pill tone="orange">Debe {money(c.balance)}</Pill>}{c.no_show_flag && <Pill tone="red">No vino</Pill>}{c.has_allergy && <Pill tone="red">Alergia</Pill>}</div>
            </button>))}
        </div>
        {sel ? <Detail c={sel} canEdit={canEdit} isBoss={isBoss} onEdit={() => setForm(sel)} onChanged={() => { open(sel.id); load(); }} onDeleted={() => { setSel(null); load(); }} onFail={fail} onOk={show} />
          : <div className="r3-panel"><Empty title="Elegí un cliente">Tocá uno de la lista para ver su ficha y su historial.</Empty></div>}
      </div>
      {form && <Form c={form === "new" ? null : form} isBoss={isBoss} onClose={() => setForm(null)} onFail={fail} onSaved={(id) => { setForm(null); show("Cliente guardado"); load(); open(id); }} />}
      {node}
    </div>
  );
}
