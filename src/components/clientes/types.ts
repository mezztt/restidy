export interface Cust {
  id: number; name: string; phone: string | null; email: string | null; birthday: string | null; birthday_in_days: number | null; notes: string | null;
  tags: string[]; balance: number; no_show_count: number; no_show_flag: boolean; active: boolean; consent_at: string | null;
  has_allergy: boolean | null; allergy_notes: string | null; allergy_consent_at: string | null; visits: number; spent: number; avg_ticket: number;
  last_visit: string | null; level: string; next_level: string | null; visits_to_next: number;
  history?: { id: number; number: number; channel: string; closed_at: string | null; total: number; items: string }[];
  favorites?: { name: string; qty: number }[];
  reservations?: { id: number; date: string; time: string; party_size: number; status: string }[];
  ledger?: { id: number; kind: string; amount: number; note: string | null; created_at: string }[];
  addresses?: { id: number; label: string | null; address: string; notes: string | null; zone_id: number | null; zone_name: string | null }[];
}
export const LEVEL_LABEL: Record<string, string> = { NUEVO: "Nuevo", FRECUENTE: "Frecuente", VIP: "VIP" };
export const LEVEL_TONE: Record<string, string> = { NUEVO: "gray", FRECUENTE: "blue", VIP: "violet" };
