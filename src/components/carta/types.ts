// Tipos de la pantalla Carta (coinciden con lo que devuelve /products, /categories, /modifier-groups y /price-rules)
import type { Light } from "../r1/common";

export interface Station { id: number; name: string; kind: "COCINA" | "BARRA"; color: string; active: boolean }
export interface Category { id: number; name: string; sort: number; active: boolean; default_station_id: number | null; product_count: number }
export interface Variant { id: number; name: string; price: number; is_default: boolean; recipe_factor: number }
export interface AllergenLink { code: string; name: string; level: "CONTIENE" | "TRAZAS" }
export interface CostInfo { cost: number | null; food_cost_pct: number | null; light: Light; margin: number | null; margin_pct: number | null; incomplete: boolean }
export interface ComboOption { id: number; product_id: number; name: string; surcharge: number }
export interface ComboSlot { id: number; name: string; options: ComboOption[] }
export type GlutenStatus = "NO_DECLARADO" | "CONTIENE" | "SIN_TACC_ELABORACION";

export interface Product {
  id: number; category_id: number; name: string; description: string | null; price: number; kind: "SIMPLE" | "COMBO";
  station_id: number | null; active: boolean; sold_out: boolean; sold_out_until: string | null; image_url: string | null;
  alcohol: boolean; gluten_status: GlutenStatus; sin_tacc: boolean; is_vegan: boolean; is_vegetarian: boolean; allergens_declared: boolean;
  visible_salon: boolean; visible_qr: boolean; visible_delivery: boolean; track_stock: boolean; sort: number;
  price_now: number; price_rule: string | null; allergens: AllergenLink[]; variants: Variant[]; group_ids: number[];
  slots?: ComboSlot[]; cost?: CostInfo | null;
}

export interface GroupOption { id: number; name: string; price_delta: number; ingredient_id: number | null; ingredient_qty: number | null; allergen_codes: string[]; active: boolean }
export interface ModGroup { id: number; name: string; min_select: number; max_select: number; required: boolean; product_count: number; options: GroupOption[] }
export interface AllergenCat { id: number; code: string; name: string }

export interface PriceRule {
  id: number; name: string; channel: string; days: number[]; time_from: string | null; time_to: string | null;
  scope: "PRODUCTO" | "CATEGORIA" | "TODO"; scope_id: number | null; scope_name: string | null; kind: "PCT" | "PRECIO_FIJO";
  value: number; priority: number; active: boolean; active_now: boolean;
}

export const GLUTEN_LABEL: Record<GlutenStatus, string> = {
  NO_DECLARADO: "Sin declarar", CONTIENE: "Contiene gluten", SIN_TACC_ELABORACION: "Sin TACC (declarado por el local)",
};

export const SIN_TACC_NOTICE =
  "Al marcar «Sin TACC» declarás que este plato se elabora sin ingredientes con gluten y con los cuidados necesarios para evitar la " +
  "contaminación cruzada. Restidy no certifica ni garantiza que sea apto para celíacos: la declaración y su veracidad son del local " +
  "(Ley 26.588). Ante dudas, consultá con un nutricionista o con bromatología.";

export const CHANNEL_LABEL: Record<string, string> = { TODOS: "Todos los canales", SALON: "Salón", MOSTRADOR: "Mostrador", DELIVERY: "Delivery y take-away", WEB: "Pedidos online" };
export const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const DAY_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export interface Notify { show: (t: string, error?: boolean) => void; fail: (e: unknown) => void }
