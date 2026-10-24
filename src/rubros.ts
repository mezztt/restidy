// Tipos de negocio ("rubros") de Restidy: mismos datos que backend/rubros.py (fuente: specs/rubros.json).
// Al crear un local desde el panel, elegir uno tilda los módulos sugeridos (se pueden cambiar a mano).
import { withDependencies } from "./config";

export interface RubroInfo { key: string; label: string; icon: string; tagline: string; modules: string[] }

export const RUBROS: RubroInfo[] = [
  { key: "RESTAURANTE", label: "Restaurante", icon: "🍽️", tagline: "Salón, cocina y reservas",
    modules: ["salon", "cocina", "caja", "reservas", "stock", "compras", "personal", "clientes", "web_carta", "web_reservas", "reportes"] },
  { key: "PARRILLA", label: "Parrilla", icon: "🥩", tagline: "Salón, cocina y pedidos",
    modules: ["salon", "cocina", "caja", "reservas", "stock", "compras", "delivery", "web_carta", "web_reservas", "web_pedidos"] },
  { key: "BAR", label: "Bar o cervecería", icon: "🍺", tagline: "Mesas, barra y stock",
    modules: ["salon", "caja", "reservas", "stock", "compras", "personal", "web_carta", "reportes"] },
  { key: "CAFETERIA", label: "Cafetería y panadería", icon: "☕", tagline: "Mostrador rápido y stock",
    modules: ["mostrador", "caja", "stock", "compras", "clientes", "web_carta", "reportes"] },
  { key: "PIZZERIA_ROTISERIA", label: "Pizzería y rotisería", icon: "🍕", tagline: "Mostrador, cocina y delivery",
    modules: ["mostrador", "cocina", "caja", "delivery", "web_pedidos", "web_carta", "stock", "clientes"] },
  { key: "HELADERIA", label: "Heladería y postres", icon: "🍨", tagline: "Mostrador, stock y pedidos",
    modules: ["mostrador", "caja", "stock", "compras", "web_carta", "delivery"] },
  { key: "DARK_KITCHEN", label: "Dark kitchen", icon: "📦", tagline: "Solo pedidos y delivery",
    modules: ["cocina", "caja", "delivery", "web_pedidos", "web_carta", "stock", "compras", "reportes"] },
  { key: "FOOD_TRUCK", label: "Food truck y carrito", icon: "🚐", tagline: "Lo justo para vender",
    modules: ["mostrador", "caja", "stock", "web_carta"] },
];
export const RUBRO_LABELS: Record<string, string> = Object.fromEntries(RUBROS.map((r) => [r.key, r.label]));

export function findRubro(key: string | null | undefined): RubroInfo | undefined {
  return RUBROS.find((r) => r.key === key);
}
/** Módulos sugeridos del tipo de negocio, con los que otros necesitan (salón -> caja, web de pedidos -> delivery…) */
export function suggestedModules(key: string | null | undefined): string[] {
  const r = findRubro(key);
  return r ? withDependencies(r.modules) : [];
}
