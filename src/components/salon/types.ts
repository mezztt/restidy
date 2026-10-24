// Tipos que comparten salón, cocina, mostrador y caja (iguales a lo que devuelve el backend: logic_r2.order_out / ticket_out)

export interface MenuModOption { id: number; name: string; price_delta: number; allergens: string[] }
export interface MenuModGroup { id: number; name: string; min_select: number; max_select: number; required: boolean; options: MenuModOption[] }
export interface MenuVariant { id: number; name: string; price: number; is_default: boolean; price_now: number }
export interface MenuComboOption { id: number; product_id: number; name: string; surcharge: number; sold_out: boolean }
export interface MenuComboSlot { id: number; name: string; options: MenuComboOption[] }
export interface MenuProduct {
  id: number; category_id: number; name: string; description: string | null; kind: string; price: number; price_now: number;
  price_rule: string | null; sold_out: boolean; alcohol: boolean; gluten_status: string; sin_tacc: boolean; is_vegan: boolean;
  is_vegetarian: boolean; allergens_declared: boolean; allergens: { code: string; name: string; level: string }[]; allergen_text: string;
  variants: MenuVariant[]; modifier_groups: MenuModGroup[]; combo_slots: MenuComboSlot[]; station_id: number | null;
}
export interface MenuCategory { id: number; name: string; products: MenuProduct[] }
export interface MenuData { channel: string; categories: MenuCategory[]; alcohol_notice: string }

export interface ItemIn {
  product_id: number; variant_id?: number | null; qty: number; modifier_option_ids: number[];
  combo_choices: { slot_id: number; product_id: number }[]; notes?: string | null; course: number; allergy_alert: boolean;
}

export interface OrderItem {
  id: number; product_id: number; variant_id: number | null; name: string; qty: number; unit_price: number; modifiers_total: number;
  line_total: number; notes: string | null; course: number; status: string; station_id: number | null; sent_at: string | null;
  ready_at: string | null; served_at: string | null; comped: boolean; void_reason: string | null; allergy_alert: boolean;
  modifiers: { name: string; price_delta: number }[]; alcohol: boolean; allergens: string[]; combo_parent_id: number | null;
  combo_items?: { id: number; name: string; status: string }[];
}
export interface Payment {
  id: number; method: string; amount: number; tip_amount: number; change_given: number; reference: string | null; status: string;
  split_label: string | null; fiscal_ref: string | null; created_at: string; mp_expires_at: string | null; received_by: string | null;
}
export interface OrderData {
  id: number; number: number; label: string; title: string; channel: string; status: string; table_id: number | null; table_name: string | null;
  area_name: string | null; waiter_id: number | null; waiter_name: string | null; covers: number; customer_id: number | null;
  customer_name: string | null; notes: string | null; opened_at: string; closed_at: string | null; bill_requested_at: string | null;
  ready_at: string | null; minutes_open: number; subtotal: number; discount_total: number; comped_total: number; cover_charge: number;
  cover_removed: boolean; cover_enabled: boolean; cover_text: string | null; cover_amount: number; delivery_fee: number; total: number;
  paid: number; balance: number; tip_total: number; suggested_tip: number; fiscal_ref: string | null; void_reason: string | null;
  items: OrderItem[]; to_confirm: number; unsent: number; next_course: number | null;
  discounts: { id: number; kind: string; value: number; amount: number; reason: string | null; order_item_id: number | null; authorized_by: string | null }[];
  payments: Payment[];
  settings: { tip_enabled: boolean; tip_default_pct: number; tip_options: number[]; discount_pin_pct: number; require_void_reason: boolean; mp_configured: boolean; prep_time_min: number };
  venue: { name: string | null; address: string | null; phone: string | null; cuit_text: string | null; footer: string | null };
}

export interface KdsItem {
  id: number; name: string; qty: number; notes: string | null; course: number; status: string; allergy_alert: boolean;
  modifiers: { name: string; price_delta: number }[]; allergens: string[]; ready_at: string | null;
}
export interface KdsTicket {
  id: number; number: number; status: string; station_id: number; station_name: string | null; station_color: string | null;
  sent_at: string; elapsed_sec: number; prep_time_min: number; order_id: number; order_number: number; order_label: string; channel: string;
  title: string; table_name: string | null; waiter_name: string | null; customer_name: string | null; notes: string | null;
  items: KdsItem[]; served_count: number; has_allergy: boolean; all_voided: boolean;
}

export interface ShiftData {
  id: number; status: string; register_id: number; register_name: string | null; opened_at: string; opened_by: string | null;
  opening_float: number; closed_at: string | null; closed_by: string | null; notes: string | null; blind: boolean;
  payments_count: number; orders_count: number; sales_total: number; sales_by_method: Record<string, number>;
  sales_by_channel: Record<string, number>; tips_total: number; tips_by_method: Record<string, number>; incomes: number;
  expenses: number; withdrawals: number; expected_cash: number | null; counted_cash: number | null; difference: number | null;
  open_orders: { id: number; title: string; label: string; balance: number }[]; pending_mp: number;
  movements: { id: number; kind: string; concept: string; amount: number; user: string | null; created_at: string }[];
  payments?: { id: number; order_label: string; title: string; method: string; amount: number; tip_amount: number; fiscal_ref: string | null; created_at: string }[];
}

export const ITEM_STATUS: Record<string, { label: string; tone: string }> = {
  POR_CONFIRMAR: { label: "Por confirmar", tone: "violet" },
  PENDIENTE: { label: "Sin enviar", tone: "gray" },
  ENVIADO: { label: "En cocina", tone: "blue" },
  EN_PREPARACION: { label: "Preparando", tone: "orange" },
  LISTO: { label: "Listo", tone: "green" },
  SERVIDO: { label: "Servido", tone: "gray" },
  ANULADO: { label: "Anulado", tone: "red" },
};

export const COURSE_NAMES: Record<number, string> = { 1: "Tiempo 1", 2: "Tiempo 2", 3: "Tiempo 3", 4: "Tiempo 4", 5: "Tiempo 5" };
