import { useCallback, useEffect, useRef, useState } from "react";
import "../../../r2.css";
import { appApi } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Switch, useFlash } from "../../../components/ui";
import EightySix from "../../../components/salon/EightySix";
import PrintPreview from "../../print/Ticket80";
import type { PrintDoc } from "../../print/Ticket80";
import { ITEM_STATUS, COURSE_NAMES } from "../../../components/salon/types";
import type { KdsTicket } from "../../../components/salon/types";
import { NETWORK_ERROR, beep, usePoll } from "../../../components/salon/hooks";

interface Station { id: number; name: string; kind: string; color: string | null; open: number }
interface Board { tickets: KdsTicket[]; prep_time_min: number; can_act: boolean; can_serve: boolean; counts: { open: number; ready: number } }

function fmtTimer(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Col = "nuevo" | "prep" | "listo";
const COLUMNS: { key: Col; title: string; empty: string }[] = [
  { key: "nuevo", title: "Nuevo", empty: "Sin comandas nuevas." },
  { key: "prep", title: "En preparación", empty: "Nada en preparación." },
  { key: "listo", title: "Listo", empty: "Nada listo para servir." },
];

/** En qué columna del tablero va una comanda, según el estado de sus platos */
function columnOf(t: KdsTicket): Col {
  const act = t.items.filter((i) => i.status !== "ANULADO");
  if (act.length === 0) return "nuevo";
  const ready = act.filter((i) => i.status === "LISTO" || i.status === "SERVIDO").length;
  if (t.status === "LISTO" || ready === act.length) return "listo";
  if (t.status === "EN_PREPARACION" || ready > 0 || act.some((i) => i.status === "EN_PREPARACION")) return "prep";
  return "nuevo";
}

export default function CocinaIndex() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [sel, setSel] = useState<number | "all" | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [, tick] = useState(0);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("restidy_kds_sound") !== "0"; } catch { return true; } });
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [eightySix, setEightySix] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  const { show, fail, node } = useFlash();

  const loadStations = useCallback(() => {
    appApi<{ default_station_id: number | null; stations: Station[] }>("/kds/stations").then((r) => {
      setStations(r.stations);
      setSel((cur) => cur ?? (r.default_station_id && r.stations.some((s) => s.id === r.default_station_id) ? r.default_station_id : "all"));
    }).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"));
  }, []);
  useEffect(() => { loadStations(); }, [loadStations]);

  const load = useCallback(() => {
    if (sel === null) return;
    appApi<Board>(sel === "all" ? "/kds/all" : `/kds/${sel}`).then((b) => {
      const ids = new Set(b.tickets.map((t) => t.id));
      if (seen.current && sound && b.tickets.some((t) => !seen.current!.has(t.id))) beep();
      seen.current = ids;
      setBoard(b); setFetchedAt(Date.now()); setError("");
    }).catch((e) => { if (e instanceof Error && e.message !== NETWORK_ERROR) setError(e.message); });
    if (Math.random() < 0.2) loadStations();
  }, [sel, sound, loadStations]);
  usePoll(load, 5000, [sel]);
  useEffect(() => { seen.current = null; setBoard(null); }, [sel]);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);

  async function act(path: string, status: string) {
    try { await appApi(path, { method: "PATCH", body: { status } }); load(); } catch (e) { fail(e); load(); }
  }
  async function reprint(t: KdsTicket) { try { setDoc({ kind: "comanda", ticket: await appApi<KdsTicket>(`/kds/tickets/${t.id}`) }); } catch (e) { fail(e); } }
  function toggleSound(v: boolean) { setSound(v); try { localStorage.setItem("restidy_kds_sound", v ? "1" : "0"); } catch { /* sin storage */ } if (v) beep(); }

  const extra = Math.floor((Date.now() - fetchedAt) / 1000);

  return (
    <div className="r2-page">
      <PageHeader eyebrow="SERVICIO" title="Cocina y barra" subtitle="Las comandas llegan solas, la más antigua primero.">
        <button className="secondary-button" onClick={() => setEightySix(true)}>Platos agotados (86)</button>
      </PageHeader>
      {error && <div className="rs-note rs-note-error" role="alert">{error}</div>}
      <div className="r2-kds-bar">
        <div className="r2-station-chips" role="tablist" aria-label="Estación">
          <button role="tab" className={sel === "all" ? "is-on" : ""} onClick={() => setSel("all")}>Todas</button>
          {(stations || []).map((s) => <button key={s.id} role="tab" className={sel === s.id ? "is-on" : ""} onClick={() => setSel(s.id)}>{s.name}{s.open > 0 && <b>{s.open}</b>}</button>)}
        </div>
        <Switch on={sound} onChange={toggleSound} label="Sonido de comanda nueva" />
      </div>

      {!board && !error ? <Loading text="Cargando comandas..." /> : board && (board.tickets.length === 0 ? (
        <Empty title="No hay comandas pendientes">Cuando el mozo envíe un pedido, aparece acá con su cronómetro.</Empty>
      ) : (
        <div className="r2-kds-board">
          {COLUMNS.map((col) => {
            const list = board.tickets.filter((t) => columnOf(t) === col.key);
            return (
              <section key={col.key} className={`r2-kds-col is-${col.key}`} aria-label={col.title}>
                <header className="r2-kds-col-head"><h2>{col.title}</h2><b>{list.length}</b></header>
                <div className="r2-kds-col-body">
                  {list.length === 0 && <p className="r2-kds-col-empty">{col.empty}</p>}
                  {list.map((t) => {
                    const sec = t.elapsed_sec + extra;
                    const limit = t.prep_time_min * 60;
                    const tm = t.status === "LISTO" ? "" : sec >= limit ? "tm-late" : sec >= limit * 0.7 ? "tm-warn" : "tm-ok";
                    const active = t.items.filter((i) => i.status !== "ANULADO");
                    return (
              <article key={t.id} className={`r2-ticket ${tm} ${t.status === "LISTO" ? "is-ready" : ""}`} aria-label={`Comanda ${t.number}, ${t.table_name ? `mesa ${t.table_name}` : t.title}`}>
                <div className="r2-ticket-head">
                  <div><strong>{t.table_name ? `Mesa ${t.table_name}` : t.title}</strong><small>#{t.number} · {t.station_name || "Cocina"}{t.waiter_name ? ` · ${t.waiter_name}` : ""}{t.customer_name ? ` · ${t.customer_name}` : ""}</small></div>
                  <span className="r2-timer" aria-label={`${Math.floor(sec / 60)} minutos`}>{fmtTimer(sec)}</span>
                </div>
                {t.has_allergy && <div className="r2-allergy-banner" role="alert">ALERGIA / CELÍACO: cuidado con el cruce</div>}
                {t.notes && <div className="r2-sheet-note" style={{ padding: "6px 12px", fontFamily: "inherit", color: "var(--rs-orange-text)", fontWeight: 700 }}>Mesa: {t.notes}</div>}
                {t.all_voided && <div className="r2-void-note">COMANDA ANULADA: no la prepares</div>}
                <div className="r2-ticket-body">
                  {t.items.map((i) => {
                    const st = ITEM_STATUS[i.status] || { label: i.status, tone: "gray" };
                    const void_ = i.status === "ANULADO";
                    return (
                      <div key={i.id} className={`r2-kitem ${void_ ? "is-void" : ""}`}>
                        <div className="r2-kitem-main"><span className="qty">{i.qty}×</span>{i.name}{i.course > 1 && <small> · {COURSE_NAMES[i.course] || `Tiempo ${i.course}`}</small>}</div>
                        {i.modifiers.map((m, k) => <div key={k} className="r2-item-sub">+ {m.name}</div>)}
                        {i.notes && <div className="r2-item-note">{i.notes}</div>}
                        {i.allergy_alert && !void_ && <span className="r2-item-alert">ALERGIA</span>}
                        {void_ && <div className="r2-item-note">ANULADO</div>}
                        <div className="r2-kitem-state">
                          <Pill tone={st.tone}>{st.label}</Pill>
                          {board.can_act && i.status === "ENVIADO" && <button className="r2-mini" onClick={() => act(`/kds/items/${i.id}`, "EN_PREPARACION")}>Empezar</button>}
                          {board.can_act && (i.status === "ENVIADO" || i.status === "EN_PREPARACION") && <button className="r2-mini is-ok" onClick={() => act(`/kds/items/${i.id}`, "LISTO")}>Listo</button>}
                          {board.can_serve && i.status === "LISTO" && <button className="r2-mini" onClick={() => act(`/kds/items/${i.id}`, "SERVIDO")}>Servido</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="r2-ticket-foot">
                  {board.can_act && active.some((i) => i.status === "ENVIADO") && <button className="secondary-button r2-btn-sm" onClick={() => act(`/kds/tickets/${t.id}`, "EN_PREPARACION")}>Empezar todo</button>}
                  {board.can_act && active.some((i) => i.status === "ENVIADO" || i.status === "EN_PREPARACION") && <button className="primary-button r2-btn-sm" onClick={() => act(`/kds/tickets/${t.id}`, "LISTO")}>Todo listo</button>}
                  {board.can_serve && t.status === "LISTO" && <button className="primary-button r2-btn-sm" onClick={() => act(`/kds/tickets/${t.id}`, "SERVIDO")}>Todo servido</button>}
                  {board.can_act && t.all_voided && <button className="primary-button r2-btn-sm" onClick={() => act(`/kds/tickets/${t.id}`, "CERRADO")}>Entendido</button>}
                  <button className="r2-mini" onClick={() => reprint(t)}>Imprimir comanda</button>
                </div>
              </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ))}
      {eightySix && <EightySix source="kds" station={sel === "all" ? 0 : (sel as number)} onClose={() => setEightySix(false)} onFail={fail} onOk={show} />}
      {doc && <PrintPreview doc={doc} onClose={() => setDoc(null)} />}
      {node}
    </div>
  );
}
