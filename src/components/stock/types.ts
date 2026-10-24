import type { Light } from "../r1/common";

export interface Ingredient {
  id: number; name: string; unit: string; stock_qty: number; min_qty: number; cost_avg: number; cost_last: number; category: string | null;
  default_supplier_id: number | null; default_supplier_name?: string | null; active: boolean; state: "OK" | "BAJO" | "NEGATIVO"; stock_value: number; missing?: number;
}
export interface RecipeItem { id: number; ingredient_id: number | null; ingredient_name: string | null; unit: string | null; sub_recipe_id: number | null; sub_recipe_name: string | null; qty: number; waste_pct: number; cost_avg: number | null }
export interface Recipe { id: number; product_id: number | null; variant_id: number | null; name: string; kind: string; yield_qty: number; yield_unit: string; items: RecipeItem[]; cost: number | null }
export interface CostRow {
  id: number; name: string; category_id: number; category_name: string | null; price: number; has_recipe: boolean; light: Light; cost: number | null; net_price: number;
  food_cost_pct: number | null; margin: number | null; margin_pct: number | null; incomplete: boolean;
  variants: { id: number; name: string; price: number; cost: number | null; food_cost_pct: number | null; light: Light; margin: number | null }[];
}
export interface CostsPayload {
  thresholds: { green: number; amber: number; iva_pct: number };
  summary: { total: number; verde: number; ambar: number; rojo: number; sin_costo: number; avg_food_cost: number | null }; rows: CostRow[];
}
export interface Movement { id: number; ingredient_id: number; ingredient_name: string; unit: string; kind: string; qty: number; unit_cost: number; value: number; reason: string | null; user_name: string | null; created_at: string }
export interface Summary { ingredients: number; low: number; negative: number; stock_value: number; products: number; without_recipe: number; red: number }
export interface InvLine { ingredient_id: number; name: string; unit: string; category: string | null; expected: number; counted: number | null; diff: number | null; diff_value: number | null }
export interface Inventory { id: number; date: string; status: "ABIERTO" | "APLICADO"; notes: string | null; lines_count: number; counted_count: number; diff_value: number; lines?: InvLine[] }
export interface Notify { show: (t: string, error?: boolean) => void; fail: (e: unknown) => void }
export interface SupplierOpt { id: number; name: string }
export const MOVE_LABEL: Record<string, string> = { COMPRA: "Compra", CONSUMO: "Consumo", MERMA: "Merma", AJUSTE: "Ajuste", INVENTARIO: "Inventario", ANULACION: "Anulación" };
