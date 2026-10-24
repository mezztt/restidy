export interface Res {
  id: number; customer_name: string; phone: string | null; email: string | null; party_size: number; date: string; time: string; duration_min: number;
  status: string; status_label: string; source: string; notes: string | null; deposit_amount: number; deposit_status: string;
  deposit_expires_at: string | null; customer_id: number | null; customer_no_shows: number; no_show_flag: boolean; order_id: number | null;
  cancel_reason: string | null; table_ids: number[]; table_names: string[];
}
export interface TableLite { id: number; name: string; seats: number; area_id: number | null; area: string | null }
export interface Period {
  id: number; name: string; days: number[]; open_time: string; close_time: string; slot_minutes: number; max_covers_per_slot: number;
  max_party_size: number; min_notice_min: number; max_days_ahead: number; active: boolean;
}
export interface Slot { time: string; period_id: number; period_name: string; available: boolean; reason: string | null; table_ids: number[] }
export interface Avail { slots: Slot[]; closed_reason: string | null; duration_min: number }
export interface DayData {
  date: string; tables: TableLite[]; reservations: Res[]; periods: Period[]; blocked: { id: number; period_id: number | null; reason: string | null }[];
  totals: { reservations: number; covers: number }; settings: { no_show_tolerance_min: number };
}
export interface WaitRow { id: number; name: string; phone: string | null; party_size: number; quoted_minutes: number | null; status: string; waiting_min: number }
export const STATUS_TONE: Record<string, string> = { PENDIENTE_SENIA: "orange", CONFIRMADA: "green", SENTADA: "blue", COMPLETADA: "gray", CANCELADA: "gray", NO_SHOW: "red" };
export const SOURCE_LABEL: Record<string, string> = { WEB: "Web", MANUAL: "Local", TELEFONO: "Teléfono" };
