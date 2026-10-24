export interface DeliveryRow {
  id: number; order_id: number; number: number; kind: "DELIVERY" | "TAKEAWAY"; status: string; status_label: string; customer_name: string;
  phone: string | null; address: string | null; address_notes: string | null; zone_id: number | null; zone_name: string | null; fee: number;
  courier_id: number | null; courier_name: string | null; source: string; promised_at: string | null; created_at: string; cancel_reason: string | null;
  total: number; paid: number; to_collect: number; pending_online_payment: boolean; notes: string | null; items_count: number; has_allergy: boolean;
  items_brief: string;
  items?: { name: string; qty: number; line_total: number; notes: string | null; modifiers: string[] }[];
  history?: { from: string | null; to: string; at: string; by: string | null }[];
  venue?: { name: string | null; address: string | null; phone: string | null; footer: string | null };
  payments?: { method: string; amount: number; status: string }[];
}
export interface Zone { id: number; name: string; fee: number; min_order: number; est_minutes: number; active: boolean; in_use: boolean }
export interface Courier { id: number; name: string; phone: string | null; user_id: number | null; user_name: string | null; active: boolean; active_orders: number }

export const SOURCE_LABEL: Record<string, string> = { MANUAL: "Mostrador", TELEFONO: "Teléfono", WEB: "Web" };
export const STATUS_TONE: Record<string, string> = {
  PENDIENTE_PAGO: "orange", NUEVO: "red", CONFIRMADO: "blue", EN_PREPARACION: "orange", LISTO: "green", EN_CAMINO: "violet",
  ENTREGADO: "gray", RETIRADO: "gray", CANCELADO: "gray",
};
/** Próximo paso natural de un pedido según su tipo */
export function nextStep(d: { kind: string; status: string }): { status: string; label: string } | null {
  switch (d.status) {
    case "NUEVO": return { status: "CONFIRMADO", label: "Confirmar y mandar a cocina" };
    case "CONFIRMADO": return { status: "EN_PREPARACION", label: "Empezar a preparar" };
    case "EN_PREPARACION": return { status: "LISTO", label: "Marcar listo" };
    case "LISTO": return d.kind === "DELIVERY" ? { status: "EN_CAMINO", label: "Salió a repartir" } : { status: "RETIRADO", label: "Retirado por el cliente" };
    case "EN_CAMINO": return { status: "ENTREGADO", label: "Entregado" };
    default: return null;
  }
}
export function isLate(d: { status: string; promised_at: string | null }): boolean {
  return !!d.promised_at && !["ENTREGADO", "RETIRADO", "CANCELADO"].includes(d.status) && new Date(d.promised_at).getTime() < Date.now();
}
