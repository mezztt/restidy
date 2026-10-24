import { useEffect, useRef, useState } from "react";
import { money } from "../../config";

export interface PlanTable {
  id: number; name: string; area_id: number; seats: number; shape: string; x: number; y: number; w: number; h: number; state: string;
  order_id: number | null; waiter_name: string | null; mine: boolean; covers: number; total: number; minutes: number; ready_count: number;
  to_confirm: number; calls: string[]; reservation: { name: string; time: string; party: number } | null;
}

export const STATE_TEXT: Record<string, string> = { LIBRE: "Libre", OCUPADA: "Ocupada", CUENTA_PEDIDA: "Pidió la cuenta", RESERVADA: "Reservada" };

function label(t: PlanTable): string {
  const parts = [`Mesa ${t.name}`, STATE_TEXT[t.state] || t.state, `${t.seats} lugares`];
  if (t.order_id) parts.push(`${t.covers} comensales`, money(t.total), `${t.minutes} minutos`);
  if (t.ready_count) parts.push(`${t.ready_count} plato${t.ready_count === 1 ? "" : "s"} listo${t.ready_count === 1 ? "" : "s"}`);
  if (t.calls.length) parts.push("llamó al mozo");
  return parts.join(", ");
}

function Inner({ t }: { t: PlanTable }) {
  return (
    <>
      <strong>{t.name}</strong>
      {t.state === "LIBRE" && <small>{t.seats} lugares</small>}
      {t.state === "RESERVADA" && <small>{t.reservation?.time || "Reservada"}</small>}
      {t.order_id && <small className="r2-money">{money(t.total)}</small>}
      {t.order_id && <small>{t.minutes} min</small>}
      {t.ready_count > 0 && <span className="r2-table-badge" aria-hidden="true">{t.ready_count}</span>}
      {(t.calls.length > 0 || t.to_confirm > 0) && <span className="r2-table-badge is-call" aria-hidden="true">!</span>}
    </>
  );
}

/** Plano de mesas con la posición cargada en Configuración. Si las mesas no tienen posición, se muestra una grilla. */
export default function Plano({ tables, activeId, onPick, list }: { tables: PlanTable[]; activeId: number | null; onPick: (t: PlanTable) => void; list?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    setWidth(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list]);

  const positioned = tables.some((t) => t.x > 0 || t.y > 0);
  if (list || !positioned) {
    return (
      <div className="r2-grid-tables">
        {tables.map((t) => (
          <button key={t.id} type="button" className={`r2-table shape-CUADRADA st-${t.state} ${t.mine ? "is-mine" : ""} ${activeId === t.id ? "is-active" : ""}`} onClick={() => onPick(t)} aria-label={label(t)}>
            <Inner t={t} />
          </button>
        ))}
      </div>
    );
  }
  const W = Math.max(...tables.map((t) => t.x + t.w)) + 16;
  const H = Math.max(...tables.map((t) => t.y + t.h)) + 16;
  const scale = width > 0 ? Math.min(1.4, width / W) : 1;
  return (
    <div className="r2-plan-wrap" ref={box} style={{ height: H * scale }}>
      <div className="r2-plan" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {tables.map((t) => (
          <button key={t.id} type="button" className={`r2-table shape-${t.shape} st-${t.state} ${t.mine ? "is-mine" : ""} ${activeId === t.id ? "is-active" : ""}`}
            style={{ left: t.x + 8, top: t.y + 8, width: t.w, height: t.h }} onClick={() => onPick(t)} aria-label={label(t)}>
            <Inner t={t} />
          </button>
        ))}
      </div>
    </div>
  );
}
