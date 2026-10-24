export interface Supplier {
  id: number; name: string; cuit_text: string | null; phone: string | null; email: string | null; contact: string | null; payment_terms: string | null;
  notes: string | null; active: boolean; debt: number; overdue: number; due_soon: number; open_count: number;
  items?: { ingredient_id: number; ingredient_name: string; unit: string; code: string | null; last_price: number }[];
}
export interface Ing { id: number; name: string; unit: string; cost_last: number; cost_avg: number; active: boolean; default_supplier_id: number | null; missing?: number; min_qty?: number; stock_qty?: number }
export interface OrderItem { id?: number; ingredient_id: number; ingredient_name: string; unit: string; qty: number; unit_cost: number; received_qty: number; pending_qty: number }
export interface Order { id: number; supplier_id: number; supplier_name: string | null; status: "BORRADOR" | "ENVIADA" | "PARCIAL" | "RECIBIDA" | "CANCELADA"; expected_date: string | null; notes: string | null; created_at: string; total: number; items_count: number; items?: OrderItem[] }
export interface Purchase {
  id: number; supplier_id: number; supplier_name: string | null; doc_type: string | null; doc_number: string | null; date: string; due_date: string | null; total: number; paid: number; pending: number;
  status: "PENDIENTE" | "PAGA"; order_id: number | null; notes: string | null; overdue: boolean; due_soon: boolean;
  items?: { ingredient_id: number; ingredient_name: string; unit: string; qty: number; unit_cost: number; subtotal: number }[];
  payments?: { id: number; method: string; amount: number; date: string }[];
}
export interface AccountRow { kind: "CARGO" | "PAGO"; date: string; label: string; amount: number; balance: number; purchase_id: number }
export interface PriceRow { ingredient_id: number; ingredient_name: string; unit: string; date: string; qty: number; unit_cost: number; change_pct: number | null; doc: string }
export interface Notify { show: (t: string, error?: boolean) => void; fail: (e: unknown) => void }
export const ORDER_LABEL: Record<string, [string, string]> = { BORRADOR: ["gray", "Borrador"], ENVIADA: ["blue", "Enviado"], PARCIAL: ["orange", "Recibido parcial"], RECIBIDA: ["green", "Recibido"], CANCELADA: ["red", "Cancelado"] };
export const METHODS: [string, string][] = [["EFECTIVO", "Efectivo"], ["TRANSFERENCIA", "Transferencia"], ["DEBITO", "Débito"], ["CREDITO", "Crédito"], ["MERCADOPAGO", "Mercado Pago"], ["QR", "QR"], ["OTRO", "Otro"]];
export const DOC_TYPES = ["Factura A", "Factura B", "Factura C", "Remito", "Ticket", "Otro"];
