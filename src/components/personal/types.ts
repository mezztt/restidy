export interface Staff {
  id: number; user_id: number | null; name: string; dni_text: string | null; phone: string | null; job: string | null; tip_weight: number;
  food_handler_number: string | null; food_handler_expires_on: string | null; carnet_state: string; carnet_days_left: number | null; active: boolean;
}
export interface Shift { id: number; staff_id: number; date: string; start_time: string; end_time: string; area: string | null; status: string; hours: number }
export interface TimeOff { id: number; staff_id: number; from_date: string; to_date: string; reason: string | null }
export interface Week { from: string; to: string; shifts: Shift[]; time_off: TimeOff[] }
export interface BoardRow { staff_id: number; name: string; job: string | null; has_pin: boolean; clocked_in: boolean; since: string | null; shift_today: string | null }
export interface AttRow { id: number; staff_id: number; name: string | null; in_at: string; out_at: string | null; hours: number }
export interface TipLine { staff_id: number; name: string | null; job?: string | null; weight: number; amount: number }
export interface TipDist { id: number | null; from_date: string; to_date: string; rule: string; total: number; lines: TipLine[]; saved?: boolean; note?: string }
export const CARNET_LABEL: Record<string, string> = { SIN_CARNET: "Sin carnet cargado", VIGENTE: "Vigente", POR_VENCER: "Por vencer", VENCIDO: "Vencido" };
export const CARNET_TONE: Record<string, string> = { SIN_CARNET: "gray", VIGENTE: "green", POR_VENCER: "orange", VENCIDO: "red" };
export const RULE_LABEL: Record<string, string> = { PARTES_IGUALES: "Partes iguales", POR_HORAS: "Por horas fichadas", POR_PUNTOS: "Por puntos de cada persona" };
export const SHIFT_LABEL: Record<string, string> = { PLANIFICADO: "Planificado", CUMPLIDO: "Cumplido", AUSENTE: "Ausente" };
