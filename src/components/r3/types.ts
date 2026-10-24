// Tipos y cuentas compartidas por Delivery, la carta pública, el pedido en mesa y el pedido online.
export interface MenuVariant { id: number; name: string; is_default: boolean; price: number }
export interface MenuOption { id: number; name: string; price_delta: number }
export interface MenuGroup { id: number; name: string; min: number; max: number; required: boolean; options: MenuOption[] }
export interface MenuAllergen { code: string; name: string; level: string }
export interface MenuProduct {
  id: number; name: string; description: string | null; kind: string; image_url: string | null;
  price: number; price_now: number; sold_out: boolean; orderable: boolean; alcohol: boolean; vegan: boolean; vegetarian: boolean;
  gluten_status: string; sin_tacc: boolean; allergens_declared: boolean; allergens: MenuAllergen[]; allergen_text: string;
  variants: MenuVariant[]; modifier_groups: MenuGroup[];
}
export interface MenuCategory { id: number; name: string; products: MenuProduct[] }
export interface MenuData {
  categories: MenuCategory[]; allergen_catalog: { code: string; name: string }[]; has_alcohol: boolean;
  alcohol_notice: string | null; disclaimer: string; has_sin_tacc: boolean; hidden_count?: number;
}
export interface Venue {
  slug: string; name: string; address: string | null; phone: string | null; email: string | null;
  opening_hours: Record<string, string[][]>; cover_charge_enabled: boolean; cover_charge_amount: number;
  cover_charge_text: string | null; complaints_book: boolean; price_notice: string;
}

/** Una línea del pedido que se está armando */
export interface CartLine {
  key: string; product_id: number; variant_id: number | null; option_ids: number[]; qty: number; notes: string;
  name: string; detail: string; unit: number;
}

/** Precio de una unidad con la variante y los adicionales elegidos */
export function unitPrice(p: MenuProduct, variantId: number | null, optionIds: number[]): number {
  const v = p.variants.find((x) => x.id === variantId) || p.variants.find((x) => x.is_default) || p.variants[0];
  const base = v ? v.price : p.price_now;
  const extra = p.modifier_groups.flatMap((g) => g.options).filter((o) => optionIds.includes(o.id)).reduce((a, o) => a + o.price_delta, 0);
  return Math.round((base + extra) * 100) / 100;
}

export function cartTotal(lines: CartLine[]): number {
  return Math.round(lines.reduce((a, l) => a + l.unit * l.qty, 0) * 100) / 100;
}

/** Lo que se manda al backend (OrderLineIn) */
export function toPayload(lines: CartLine[]) {
  return lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, qty: l.qty, option_ids: l.option_ids, notes: l.notes.trim() || null }));
}

/** Mismo producto, variante, adicionales y nota = la misma línea (suma cantidad) */
export function lineKey(productId: number, variantId: number | null, optionIds: number[], notes: string): string {
  return `${productId}|${variantId ?? ""}|${[...optionIds].sort((a, b) => a - b).join(",")}|${notes.trim()}`;
}

/** Valida los grupos de adicionales de un producto. Devuelve el mensaje de error o "" si está bien. */
export function checkOptions(p: MenuProduct, optionIds: number[]): string {
  for (const g of p.modifier_groups) {
    const n = g.options.filter((o) => optionIds.includes(o.id)).length;
    if (n < Math.max(g.min, g.required ? 1 : 0)) return `Elegí «${g.name}»`;
    if (g.max > 0 && n > g.max) return `En «${g.name}» podés elegir hasta ${g.max}`;
  }
  return "";
}
