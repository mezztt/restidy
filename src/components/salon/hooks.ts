import { useCallback, useEffect, useRef, useState } from "react";
import { appApi, getSessionUser } from "../../config";
import type { ItemIn } from "./types";

/** Quien puede autorizar sin PIN: el dueño y el encargado (el resto necesita el PIN de un encargado) */
export function isBoss(): boolean {
  const role = getSessionUser()?.role;
  return role === "ADMINISTRADOR" || role === "ENCARGADO";
}

/** ¿Puede cobrar? Dueño, encargado y cajero; el mozo solo si el local lo habilitó para su usuario */
export function canCollect(): boolean {
  const u = getSessionUser();
  if (!u) return false;
  return u.role === "ADMINISTRADOR" || u.role === "ENCARGADO" || u.role === "CAJERO" || (u.role === "MOZO" && !!u.can_collect);
}

/** Si la mesa la atiende otro mozo, devuelve su nombre (el mozo la ve pero no la toca: regla 8) */
export function otherWaiter(order: { channel: string; waiter_id: number | null; waiter_name: string | null }): string | null {
  const u = getSessionUser();
  if (!u || u.role !== "MOZO" || (order.channel !== "SALON" && order.channel !== "QR")) return null;
  if (!order.waiter_id || order.waiter_id === u.id) return null;
  return order.waiter_name || "otro mozo";
}

/** Ejecuta `load` ahora y cada `ms` milisegundos (también al volver a la pestaña). Se corta al salir de la pantalla. */
export function usePoll(load: () => unknown, ms: number, deps: unknown[] = []) {
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive && !document.hidden) ref.current(); };
    run();
    const t = window.setInterval(run, ms);
    document.addEventListener("visibilitychange", run);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", run); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}

/** ¿Hay conexión? (el navegador avisa cuando se corta y cuando vuelve) */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

/** Pitido corto (sin archivos de audio) para avisar de una comanda nueva */
export function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    window.setTimeout(() => ctx.close(), 700);
  } catch { /* sin audio */ }
}

export const NETWORK_ERROR = "No se pudo conectar con el servidor";

// ---------------------------------------------------------------------
// Borrador local: si se corta internet, lo que el mozo carga se guarda en este equipo y se envía solo al volver
// ---------------------------------------------------------------------
const draftKey = (orderId: number) => `restidy_draft_${orderId}`;

export function readDraft(orderId: number): ItemIn[] {
  try { return JSON.parse(localStorage.getItem(draftKey(orderId)) || "[]"); } catch { return []; }
}
function writeDraft(orderId: number, items: ItemIn[]) {
  try {
    if (items.length) localStorage.setItem(draftKey(orderId), JSON.stringify(items));
    else localStorage.removeItem(draftKey(orderId));
  } catch { /* sin storage */ }
}

/**
 * Cola de ítems sin enviar al servidor de una comanda. `add(item)` los intenta enviar y, si no hay conexión, los guarda.
 * Devuelve la cola para mostrarla ("Sin conexión") y `flush()` para reintentar.
 */
export function useDraftQueue(orderId: number | null, onSynced: (order: any) => void, onError: (message: string) => void) {
  const [queue, setQueue] = useState<ItemIn[]>(() => (orderId ? readDraft(orderId) : []));
  const busy = useRef(false);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => { setQueue(orderId ? readDraft(orderId) : []); }, [orderId]);

  const save = useCallback((next: ItemIn[]) => {
    queueRef.current = next;
    setQueue(next);
    if (orderId) writeDraft(orderId, next);
  }, [orderId]);

  const flush = useCallback(async () => {
    if (!orderId || busy.current || queueRef.current.length === 0) return;
    busy.current = true;
    try {
      let rest = [...queueRef.current];
      while (rest.length) {
        try {
          const order = await appApi(`/orders/${orderId}/items`, { method: "POST", body: rest[0] });
          rest = rest.slice(1);
          save(rest);
          onSynced(order);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg === NETWORK_ERROR) break;             // sigue sin conexión: se reintenta más tarde
          rest = rest.slice(1);                         // el servidor lo rechazó (agotado, etc.): se descarta y se avisa
          save(rest);
          onError(msg || "No se pudo cargar un plato");
        }
      }
    } finally { busy.current = false; }
  }, [orderId, save, onSynced, onError]);

  useEffect(() => {
    const t = window.setInterval(() => { flush(); }, 6000);
    const on = () => { flush(); };
    window.addEventListener("online", on);
    flush();
    return () => { window.clearInterval(t); window.removeEventListener("online", on); };
  }, [flush]);

  /** Envía el ítem; si no hay conexión lo guarda. Devuelve la comanda actualizada o null si quedó guardado. */
  const add = useCallback(async (item: ItemIn) => {
    if (!orderId) return null;
    try {
      return await appApi(`/orders/${orderId}/items`, { method: "POST", body: item });
    } catch (e) {
      if (e instanceof Error && e.message === NETWORK_ERROR) { save([...queueRef.current, item]); return null; }
      throw e;
    }
  }, [orderId, save]);

  const discard = useCallback((index: number) => save(queueRef.current.filter((_, i) => i !== index)), [save]);

  return { queue, add, flush, discard };
}
