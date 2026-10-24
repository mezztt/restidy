import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, money, hhmm, dayKey, addDays, pathFor, moduleLabel } from "../config";
import type { SessionUser } from "../config";
import { RestidyLogo } from "./Brand";
import { startTour } from "./tour/Tour";

/**
 * Asistente de Restidy.
 * Responde con datos reales del local (mesas, cocina, caja, stock, reservas, delivery…) consultando la API del
 * propio sistema y explica cómo usar cada pantalla. Va por reglas: no usa IA externa, no tiene costo.
 * Solo ofrece y muestra lo que el usuario ve en su menú (módulos contratados + rol); la plata, solo con caja o reportes.
 */

interface Action { label: string; to?: string; tour?: boolean }
interface Msg { from: "bot" | "user"; text: string; actions?: Action[] }

// ---------------------------------------------------------------- texto
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** ¿Aparece alguna de las palabras? Acepta fragmentos («reserv») y errores de tipeo de una o dos letras. */
function has(t: string, ...words: string[]): boolean {
  const tokens = t.split(" ").filter((x) => x.length >= 5);
  return words.some((w) => {
    if (t.includes(w)) return true;
    if (w.includes(" ") || w.length < 5) return false;
    const max = w.length >= 9 ? 2 : 1;
    return tokens.some((tok) => lev(tok, w) <= max || (w.length > 6 && tok.length > 5 && lev(tok, w.slice(0, tok.length)) <= 1 && tok.length >= w.length - 2));
  });
}
const score = (t: string, words: string[]) => words.reduce((s, w) => s + (has(t, w) ? w.length : 0), 0);

const ADMINS = ["ADMINISTRADOR", "ENCARGADO"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const short = (s: string | null | undefined, n = 38) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
const goto = (module: string, label?: string): Action => ({ label: label || `Ir a ${moduleLabel(module)}`, to: pathFor(module) });

// ---------------------------------------------------------------- contexto de permisos
interface Ctx {
  user: SessionUser;
  can: (module: string) => boolean;
  seeMoney: boolean;     // caja o reportes
  isBoss: boolean;       // dueño o encargado
}

// ---------------------------------------------------------------- consultas con datos reales
interface Intent {
  id: string;
  suggest: string;
  keys: string[];
  /** Requisito para ofrecerla y responderla */
  allowed: (c: Ctx) => boolean;
  denied: string;
  run: (c: Ctx, t: string) => Promise<Msg>;
}

interface TableRow { id: number; name: string; state: string; minutes: number; waiter_name: string | null; mine: boolean; calls: string[]; ready_count: number; to_confirm: number }
interface KdsTicket { id: number; status: string; title: string; table_name: string | null; elapsed_sec: number; prep_time_min: number; station_name: string | null; has_allergy: boolean }
interface DeliveryRow { number: number; kind: string; status: string; status_label: string; customer_name: string; address: string | null; courier_name: string | null; promised_at: string | null }
interface ResRow { time: string; customer_name: string; party_size: number; status: string; status_label: string; table_names: string[] }
interface PendingRow { key: string; label: string; count: number; path: string; hint: string; amount?: number }

const needs = (module: string, extra?: (c: Ctx) => boolean) => (c: Ctx) => c.can(module) && (!extra || extra(c));
const CALL_LABEL: Record<string, string> = { MOZO: "llama al mozo", CUENTA: "pide la cuenta" };

const INTENTS: Intent[] = [
  {
    id: "cuentas", suggest: "Mesas que piden la cuenta",
    keys: ["piden la cuenta", "pidio la cuenta", "pidieron la cuenta", "pide la cuenta", "cuenta pedida", "cuentas pedidas", "llamados", "llaman", "llamando", "me llaman", "esperan la cuenta"],
    allowed: needs("salon"), denied: "El salón no está habilitado para tu usuario.",
    run: async () => {
      const d = await appApi<{ tables: TableRow[] }>("/salon/tables");
      const bill = d.tables.filter((x) => x.state === "CUENTA_PEDIDA");
      const calls = d.tables.filter((x) => x.calls.length && x.state !== "CUENTA_PEDIDA");
      if (!bill.length && !calls.length) return { from: "bot", text: "No hay mesas esperando la cuenta ni llamando al mozo." };
      const lines: string[] = [];
      if (bill.length) lines.push(`Pidieron la cuenta (${bill.length}):`, ...bill.map((x) => `• ${x.name}${x.waiter_name ? ` · ${x.waiter_name}` : ""} · hace ${x.minutes} min en la mesa`));
      if (calls.length) lines.push(`Llaman (${calls.length}):`, ...calls.map((x) => `• ${x.name}: ${x.calls.map((k) => CALL_LABEL[k] || "llama").join(", ")}`));
      return { from: "bot", text: lines.join("\n"), actions: [goto("salon", "Ver el salón")] };
    },
  },
  {
    id: "mesas", suggest: "¿Qué mesas están libres?",
    keys: ["mesas libres", "mesa libre", "mesas ocupadas", "mesas", "libres", "ocupadas", "hay lugar", "hay mesa", "como esta el salon", "estado del salon", "tus mesas"],
    allowed: needs("salon"), denied: "El salón no está habilitado para tu usuario.",
    run: async (c) => {
      const d = await appApi<{ tables: TableRow[] }>("/salon/tables");
      if (!d.tables.length) return { from: "bot", text: "Todavía no hay mesas cargadas.", actions: c.user.role === "ADMINISTRADOR" ? [goto("configuracion", "Cargar mesas")] : undefined };
      const by = (s: string) => d.tables.filter((x) => x.state === s);
      const libres = by("LIBRE"), ocup = by("OCUPADA"), cuenta = by("CUENTA_PEDIDA"), res = by("RESERVADA"), limp = by("POR_LIMPIAR");
      const names = (l: TableRow[]) => l.map((x) => x.name).join(", ");
      const lines = [
        `Libres (${libres.length}): ${libres.length ? names(libres) : "ninguna"}`,
        `Ocupadas (${ocup.length + cuenta.length}): ${ocup.length + cuenta.length ? names([...ocup, ...cuenta]) : "ninguna"}`,
        cuenta.length ? `Con la cuenta pedida: ${names(cuenta)}` : "",
        res.length ? `Reservadas por llegar: ${names(res)}` : "",
        limp.length ? `Por limpiar: ${names(limp)}` : "",
      ].filter(Boolean);
      const mine = d.tables.filter((x) => x.mine);
      if (c.user.role === "MOZO" && mine.length) lines.push(`Tus mesas: ${names(mine)}`);
      return { from: "bot", text: lines.join("\n"), actions: [goto("salon", "Ver el salón")] };
    },
  },
  {
    id: "cocina", suggest: "¿Qué hay en cocina?",
    keys: ["cocina", "comandas", "comanda", "en preparacion", "platos listos", "listos para servir", "para llevar a la mesa", "que sale", "demora", "demorado", "atrasado"],
    allowed: needs("cocina"), denied: "La cocina no está habilitada para tu usuario.",
    run: async () => {
      const d = await appApi<{ tickets: KdsTicket[]; counts: { open: number; ready: number }; prep_time_min: number }>("/kds/all");
      if (!d.tickets.length) return { from: "bot", text: "La cocina está al día: no hay comandas pendientes.", actions: [goto("cocina")] };
      const late = d.tickets.filter((x) => x.elapsed_sec > (x.prep_time_min || d.prep_time_min) * 60);
      const label = (s: string) => (s === "LISTO" ? "listo" : s === "EN_PREPARACION" ? "preparando" : "nuevo");
      const lines = [
        `Hay ${plural(d.counts.open, "comanda", "comandas")} en cocina y barra; ${d.counts.ready} lista${d.counts.ready === 1 ? "" : "s"} para servir.`,
        late.length ? `Demoradas (más de ${d.prep_time_min} min): ${late.length}.` : "",
        ...d.tickets.slice(0, 6).map((x) => `• ${short(x.title)}${x.station_name ? ` · ${x.station_name}` : ""} · ${Math.floor(x.elapsed_sec / 60)} min · ${label(x.status)}${x.has_allergy ? " · ALERGIA" : ""}`),
        d.tickets.length > 6 ? `… y ${d.tickets.length - 6} más.` : "",
      ].filter(Boolean);
      return { from: "bot", text: lines.join("\n"), actions: [goto("cocina")] };
    },
  },
  {
    id: "mostrador", suggest: "Ventas de mostrador",
    keys: ["mostrador", "venta rapida", "retirar", "para retirar"],
    allowed: needs("mostrador"), denied: "El mostrador no está habilitado para tu usuario.",
    run: async () => {
      const list = await appApi<{ id: number; label: string; customer_name: string | null; status: string; balance: number; summary: string; all_ready: boolean; delivered: boolean; kitchen: { cooking: number } }[]>("/mostrador/orders");
      const active = list.filter((o) => !o.delivered && o.status !== "ANULADO");
      if (!active.length) return { from: "bot", text: "No hay ventas de mostrador en curso.", actions: [goto("mostrador")] };
      const toPay = active.filter((o) => o.balance > 0).length;
      const ready = active.filter((o) => o.all_ready).length;
      const cooking = active.filter((o) => o.kitchen.cooking > 0).length;
      return {
        from: "bot",
        text: `En el mostrador hay ${plural(active.length, "venta", "ventas")} en curso: ${toPay} por cobrar, ${cooking} preparándose y ${ready} lista${ready === 1 ? "" : "s"} para retirar.\n` +
          active.slice(0, 5).map((o) => `• ${o.label}${o.customer_name ? ` · ${o.customer_name}` : ""} · ${short(o.summary, 40)}`).join("\n"),
        actions: [goto("mostrador")],
      };
    },
  },
  {
    id: "ventas", suggest: "¿Cuánto vendimos hoy?",
    keys: ["vendi", "vendimos", "ventas", "venta de hoy", "facturacion", "facturamos", "recaudado", "recaudamos", "cuanto llevamos", "cuanto se hizo", "plata de hoy", "ingresos", "caja del dia"],
    allowed: (c) => c.seeMoney, denied: "Tu usuario no ve la plata del local. Pedíselo a quien administra.",
    run: async (c, t) => {
      if (has(t, "mes", "mensual") && c.can("reportes") && c.isBoss) {
        const now = new Date();
        const from = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
        const r = await appApi<{ total_sales: number; orders: number; previous: { change_pct: number | null } }>(`/reports/sales?from_date=${from}&to_date=${dayKey(now)}`);
        const ch = r.previous?.change_pct;
        return {
          from: "bot",
          text: `En lo que va del mes vendiste ${money(r.total_sales)} en ${plural(r.orders, "cuenta", "cuentas")}.${typeof ch === "number" ? ` Contra el período anterior de igual largo: ${ch >= 0 ? "+" : ""}${ch}%.` : ""}`,
          actions: [goto("reportes", "Ver reportes")],
        };
      }
      const d = await appApi<{ sales_today: number; orders_paid_today: number; open_orders: number }>("/dashboard");
      return {
        from: "bot",
        text: `Hoy se cobraron ${money(d.sales_today)} en ${plural(d.orders_paid_today, "cuenta", "cuentas")}.${d.open_orders ? ` Quedan ${plural(d.open_orders, "cuenta abierta", "cuentas abiertas")}.` : ""}`,
        actions: [c.can("caja") ? goto("caja") : goto("reportes")],
      };
    },
  },
  {
    id: "caja", suggest: "¿Hay caja abierta?",
    keys: ["caja abierta", "caja cerrada", "turno de caja", "mi caja", "efectivo en caja", "arqueo", "la caja"],
    allowed: needs("caja", (c) => c.user.role !== "MOZO"), denied: "La caja no está habilitada para tu usuario.",
    run: async () => {
      const d = await appApi<{ shift: null | { register_name: string | null; opened_at: string; opened_by: string | null; sales_total: number; payments_count: number; expected_cash: number | null; blind: boolean; open_orders: unknown[] }; stale: boolean; registers: { name: string; open_shift_id: number | null }[] }>("/cash/shifts/current");
      if (!d.shift) {
        const others = d.registers.filter((r) => r.open_shift_id);
        return {
          from: "bot",
          text: `No tenés un turno de caja abierto.${others.length ? ` Hay abierta: ${others.map((r) => r.name).join(", ")}.` : " La caja está cerrada."}`,
          actions: [goto("caja", "Abrir caja")],
        };
      }
      const s = d.shift;
      const lines = [
        `Caja${s.register_name ? ` «${s.register_name}»` : ""} abierta desde las ${hhmm(s.opened_at)}${s.opened_by ? ` por ${s.opened_by}` : ""}.`,
        `Cobrado en el turno: ${money(s.sales_total)} (${plural(s.payments_count, "cobro", "cobros")}).`,
        s.blind ? "Arqueo ciego: el efectivo esperado se ve recién al cerrar." : s.expected_cash !== null ? `Efectivo esperado en caja: ${money(s.expected_cash)}.` : "",
        s.open_orders.length ? `Hay ${plural(s.open_orders.length, "cuenta abierta", "cuentas abiertas")} con cobros parciales.` : "",
        d.stale ? "Ojo: este turno quedó abierto de un día anterior. Conviene cerrarlo con el arqueo." : "",
      ].filter(Boolean);
      return { from: "bot", text: lines.join("\n"), actions: [goto("caja")] };
    },
  },
  {
    id: "stock", suggest: "Stock bajo",
    keys: ["stock", "insumo", "insumos", "faltante", "faltantes", "se acaba", "se acabo", "reponer", "bajo el minimo", "bajo minimo", "que falta", "que hay que comprar"],
    allowed: needs("stock"), denied: "El stock no está habilitado para tu usuario.",
    run: async (c) => {
      const list = await appApi<{ name: string; unit: string; stock_qty: number; min_qty: number; state: string; missing: number; default_supplier_name: string | null }[]>("/stock/alerts");
      if (!list.length) return { from: "bot", text: "Todos los insumos están por encima del mínimo.", actions: [goto("stock")] };
      const n = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
      return {
        from: "bot",
        text: `Hay ${plural(list.length, "insumo", "insumos")} para reponer:\n` +
          list.slice(0, 8).map((i) => `• ${i.name}: ${n(i.stock_qty)} ${i.unit} (mínimo ${n(i.min_qty)})${i.state === "NEGATIVO" ? " · en negativo" : ""}${i.default_supplier_name ? ` · ${i.default_supplier_name}` : ""}`).join("\n") +
          (list.length > 8 ? `\n… y ${list.length - 8} más.` : ""),
        actions: [goto("stock"), ...(c.can("compras") && c.isBoss ? [goto("compras", "Ir a Compras")] : [])],
      };
    },
  },
  {
    id: "reservas", suggest: "Reservas de hoy",
    keys: ["reserva", "reservas", "reservaron", "reservado", "vienen hoy", "agenda", "lista de espera", "quien viene"],
    allowed: needs("reservas"), denied: "Las reservas no están habilitadas para tu usuario.",
    run: async (_c, t) => {
      const tomorrow = has(t, "manana");
      const day = dayKey(tomorrow ? addDays(new Date(), 1) : new Date());
      const d = await appApi<{ reservations: ResRow[]; totals: { reservations: number; covers: number } }>(`/reservations/day?date=${day}`);
      const alive = d.reservations.filter((r) => ["PENDIENTE_SENIA", "CONFIRMADA", "SENTADA"].includes(r.status));
      const when = tomorrow ? "mañana" : "hoy";
      if (!alive.length) return { from: "bot", text: `No hay reservas para ${when}.`, actions: [goto("reservas", "Anotar una reserva")] };
      return {
        from: "bot",
        text: `Para ${when} hay ${plural(d.totals.reservations, "reserva", "reservas")} (${plural(d.totals.covers, "persona", "personas")}):\n` +
          alive.slice(0, 8).map((r) => `• ${r.time} · ${r.customer_name} · ${r.party_size}p${r.table_names.length ? ` · ${r.table_names.join(" + ")}` : ""} · ${r.status_label}`).join("\n") +
          (alive.length > 8 ? `\n… y ${alive.length - 8} más.` : ""),
        actions: [goto("reservas")],
      };
    },
  },
  {
    id: "delivery", suggest: "Delivery pendiente",
    keys: ["delivery", "domicilio", "take away", "takeaway", "pedidos online", "envios", "repartidor", "entregas", "pedidos para llevar"],
    allowed: needs("delivery"), denied: "El delivery no está habilitado para tu usuario.",
    run: async (c) => {
      const d = await appApi<{ items: DeliveryRow[] }>("/deliveries");
      const open = d.items.filter((x) => !["ENTREGADO", "RETIRADO", "CANCELADO"].includes(x.status));
      const mine = c.user.role === "REPARTIDOR";
      if (!open.length) return { from: "bot", text: mine ? "No tenés entregas pendientes." : "No hay pedidos de delivery ni take-away pendientes.", actions: [goto("delivery")] };
      const count = (s: string) => open.filter((x) => x.status === s).length;
      const sum = ["NUEVO", "CONFIRMADO", "EN_PREPARACION", "LISTO", "EN_CAMINO", "PENDIENTE_PAGO"]
        .map((s) => [open.find((x) => x.status === s)?.status_label, count(s)] as const).filter(([, n]) => n)
        .map(([l, n]) => `${n} ${String(l).toLowerCase()}`).join(" · ");
      return {
        from: "bot",
        text: `${mine ? "Tus pendientes" : "Pendientes"}: ${plural(open.length, "pedido", "pedidos")} (${sum}).\n` +
          open.slice(0, 6).map((x) => `• #${x.number} ${x.kind === "TAKEAWAY" ? "retira" : "envío"} · ${x.customer_name} · ${x.status_label}${x.kind === "DELIVERY" && !x.courier_name && !mine ? " · sin repartidor" : ""}`).join("\n") +
          (open.length > 6 ? `\n… y ${open.length - 6} más.` : ""),
        actions: [goto("delivery")],
      };
    },
  },
  {
    id: "personal", suggest: "¿Quién está fichado?",
    keys: ["fichado", "fichados", "fichaje", "ficho", "quien trabaja", "quien esta trabajando", "asistencia", "presentes", "quien esta"],
    allowed: needs("personal"), denied: "El personal no está habilitado para tu usuario.",
    run: async (c) => {
      const rows = await appApi<{ name: string; job: string | null; clocked_in: boolean; since: string | null; shift_today: string | null }[]>("/attendance/board");
      if (!rows.length) return { from: "bot", text: "Todavía no hay personal cargado.", actions: [goto("personal")] };
      if (!c.isBoss) {
        const me = rows[0];
        return { from: "bot", text: me.clocked_in && me.since ? `Fichaste la entrada a las ${hhmm(me.since)}.` : `Todavía no fichaste.${me.shift_today ? ` Hoy te toca ${me.shift_today}.` : ""}`, actions: [goto("personal", "Ir a fichar")] };
      }
      const on = rows.filter((r) => r.clocked_in);
      return {
        from: "bot",
        text: on.length
          ? `Fichados ahora (${on.length} de ${rows.length}):\n` + on.map((r) => `• ${r.name}${r.job ? ` · ${r.job}` : ""} · desde ${r.since ? hhmm(r.since) : "—"}`).join("\n")
          : `No hay nadie fichado ahora (${rows.length} en el equipo).`,
        actions: [goto("personal")],
      };
    },
  },
  {
    id: "compras", suggest: "Compras por vencer",
    keys: ["compras", "proveedor", "proveedores", "deuda", "le debo", "pagar a proveedores", "por vencer"],
    allowed: needs("compras", (c) => c.isBoss), denied: "Las compras no están habilitadas para tu usuario.",
    run: async (c) => {
      const d = await appApi<{ items: PendingRow[] }>("/dashboard/pending");
      const it = d.items.find((x) => x.key === "compras");
      if (!it) return { from: "bot", text: "No hay compras vencidas ni por vencer en los próximos 3 días.", actions: [goto("compras")] };
      return { from: "bot", text: `Hay ${plural(it.count, "compra", "compras")} vencida${it.count === 1 ? "" : "s"} o por vencer (3 días)${it.amount && c.seeMoney ? ` por ${money(it.amount)}` : ""}.`, actions: [goto("compras", "Ver compras")] };
    },
  },
  {
    id: "resumen", suggest: "¿Cómo viene el día?",
    keys: ["como viene el dia", "como va el dia", "resumen", "como vamos", "como andamos", "movimiento"],
    allowed: () => true, denied: "",
    run: async (c) => {
      const d = await appApi<{ sales_today: number; orders_paid_today: number; open_orders: number; occupied_tables: number; covers_open: number }>("/dashboard");
      const lines = [
        `Cuentas abiertas: ${d.open_orders}${d.occupied_tables ? ` · mesas ocupadas: ${d.occupied_tables}` : ""}${d.covers_open ? ` · ${plural(d.covers_open, "comensal", "comensales")}` : ""}.`,
        `Cuentas cobradas hoy: ${d.orders_paid_today}.`,
        c.seeMoney ? `Vendido hoy: ${money(d.sales_today)}.` : "",
      ].filter(Boolean);
      return { from: "bot", text: lines.join("\n"), actions: [{ label: "Ir al Inicio", to: "/app" }] };
    },
  },
  {
    id: "pendientes", suggest: "¿Qué tengo pendiente?",
    keys: ["pendiente", "pendientes", "que tengo que hacer", "por hacer", "novedades", "alertas", "que falta hacer", "que hay para hacer"],
    allowed: () => true, denied: "",
    run: async (c) => {
      const d = await appApi<{ items: PendingRow[] }>("/dashboard/pending");
      if (!d.items.length) return { from: "bot", text: "No tenés nada pendiente. Todo al día." };
      const paths = [...new Set(d.items.map((i) => i.path))].slice(0, 3);
      return {
        from: "bot",
        text: "Pendientes de hoy:\n" + d.items.slice(0, 8).map((i) => `• ${i.label}: ${i.count}${i.amount && c.seeMoney ? ` (${money(i.amount)})` : ""}`).join("\n"),
        actions: paths.map((p) => ({ label: `Ir a ${moduleLabelFor(p)}`, to: p })),
      };
    },
  },
];

// pantalla de una ruta (para los botones de «Pendientes»)
function moduleLabelFor(path: string): string {
  const m = path === "/app" ? "inicio" : path.replace("/app/", "").split("/")[0];
  return moduleLabel(m);
}

// ---------------------------------------------------------------- base de ayuda «cómo hago…»
interface Help { id: string; keys: string[]; text: string; module?: string; label?: string; to?: string; tour?: boolean; roles?: string[]; suggest?: string }

const HELP: Help[] = [
  {
    id: "mesa", module: "salon", suggest: "¿Cómo abro una mesa?",
    keys: ["abrir mesa", "abro una mesa", "abrir una mesa", "tomar pedido", "tomar un pedido", "cargar pedido", "cargar un pedido", "pedido de una mesa", "comanda", "mandar a cocina", "enviar a cocina", "enviar el pedido", "confirmar pedido", "pedidos del qr", "por confirmar"],
    text: "En Salón tocá una mesa libre y «Abrir mesa». Cargá los platos desde la carta (tamaño, opciones y alergias si hace falta) y tocá «Confirmar y enviar»: la comanda sale a cocina o barra. «Solo confirmar» deja el pedido confirmado sin mandarlo todavía. Los pedidos que hacen los clientes desde el QR quedan «por confirmar» hasta que un mozo los acepte.",
  },
  {
    id: "mover", module: "salon", roles: ["ADMINISTRADOR", "ENCARGADO", "MOZO", "CAJERO"],
    keys: ["mover de mesa", "cambiar de mesa", "mover mesa", "unir mesas", "unir cuentas", "juntar mesas", "pasar a otro mozo", "cambiar de mozo", "cambio de mozo"],
    text: "Abrí la mesa y tocá «Opciones»: ahí están «Mover de mesa», «Unir cuentas» (para juntar dos mesas en una sola cuenta) y «Pasar a otro mozo». Si el mozo que atiende cambia, la mesa pasa a su nombre.",
  },
  {
    id: "cobrar", module: "caja", suggest: "¿Cómo cobro una cuenta?",
    keys: ["cobrar", "cobro", "pedir la cuenta", "dividir la cuenta", "dividir cuenta", "partes iguales", "medio de pago", "medios de pago", "propina", "descuento", "efectivo", "tarjeta", "mercado pago", "precuenta", "ticket"],
    text: "Con la mesa abierta tocá «Pedir la cuenta» (podés imprimir la precuenta) y después «Cobrar». Elegí el medio de pago (efectivo, débito, crédito, transferencia, Mercado Pago…), la propina si corresponde y «Cobrar». Para dividir: en partes iguales, por monto o por ítem. Los descuentos grandes y las anulaciones piden el PIN de un encargado. Cuando lo cobrado alcanza el total, la cuenta se cierra sola.",
  },
  {
    id: "turno", module: "caja", roles: ["ADMINISTRADOR", "ENCARGADO", "CAJERO"], suggest: "¿Cómo abro y cierro la caja?",
    keys: ["abrir caja", "abrir la caja", "abro la caja", "abro caja", "cierro la caja", "cierro caja", "cerrar caja", "cerrar la caja", "cierre de caja", "cerrar turno", "turno de caja", "fondo inicial", "arqueo", "gasto", "retiro", "retirar plata", "sacar plata", "movimiento de efectivo"],
    text: "En Caja, «Abrir caja» con el fondo inicial en efectivo. Durante el turno podés anotar ingresos, gastos y retiros en «Gasto o retiro». Para terminar, «Cerrar turno»: contás el efectivo (podés ingresar el total o billete por billete) y el sistema muestra la diferencia con lo esperado. Después podés imprimir el cierre. Si quedó un turno abierto de ayer, cerralo antes de abrir uno nuevo.",
  },
  {
    id: "cocina", module: "cocina",
    keys: ["agotado", "agotar", "se acabo el plato", "86", "empezar un plato", "marcar listo", "marcar como listo", "plato listo", "pantalla de cocina", "estacion", "barra"],
    text: "En Cocina y barra cada comanda tiene sus platos: «Empezar» cuando arrancás, «Listo» cuando sale y el mozo lo marca «Servido». Podés filtrar por estación (cocina, barra…). Si se acabó un plato, usá «Platos agotados (86)» y deja de poder pedirse hasta que lo reactives. Las alergias salen resaltadas en la comanda.",
  },
  {
    id: "carta", module: "carta", roles: ["ADMINISTRADOR", "ENCARGADO", "MOZO", "COCINA"],
    keys: ["carta", "menu", "producto", "productos", "plato nuevo", "agregar plato", "cambiar precio", "precios", "sin tacc", "alergeno", "alergenos", "categoria", "combo", "variante"],
    text: "En Carta administrás categorías, productos, tamaños, opciones, combos y reglas de precio. Cada producto lleva sus alérgenos y si es sin TACC (lo declara el local). «Agotado hoy» lo saca de la venta hasta el cierre. Los cambios de precio valen para los pedidos nuevos.",
  },
  {
    id: "baja", roles: ["ADMINISTRADOR"], suggest: "¿Cómo doy de baja el servicio?",
    keys: ["dar de baja el servicio", "dar de baja el sistema", "baja del servicio", "baja del sistema", "darme de baja", "cancelar el servicio", "cancelar mi cuenta", "dejar de usar el sistema", "retirar la baja", "constancia de baja"],
    text: "Para dar de baja el servicio entrá a Configuración y tocá «Dar de baja el servicio» (también está al pie de la pantalla de ingreso). Lo hace el administrador, sin motivo y en dos pasos, y te da una constancia BAJA-AAAA-NNNN con fecha y hora para copiar o imprimir. El sistema NO se corta ese día: sigue funcionando hasta el final del período que ya pagaste, y antes de esa fecha podés «Retirar la baja». Después se desactiva y tus datos se conservan.",
  },
  {
    id: "stock", module: "stock", suggest: "¿Cómo cargo un inventario?",
    keys: ["inventario", "receta", "recetas", "costo del plato", "merma", "mermas", "ajustar stock", "cargar insumo", "nuevo insumo", "margen"],
    text: "En Stock y recetas cargás los insumos con su unidad, costo y mínimo. En Recetas armás cada plato con sus insumos y ves el costo y el margen (en rojo si el costo pasa el tope). En Inventario contás lo que hay y «Aplicar al stock» corrige las diferencias; las mermas se anotan con motivo. Si un insumo baja del mínimo, avisa en Pendientes.",
  },
  {
    id: "compras", module: "compras", roles: ["ADMINISTRADOR", "ENCARGADO"],
    keys: ["proveedor nuevo", "cargar proveedor", "cargar una compra", "registrar compra", "orden de compra", "pedido a proveedor", "pagar compra", "factura de proveedor", "cuenta corriente del proveedor"],
    text: "En Compras cargás proveedores, órdenes de compra y las compras que recibís (con sus renglones y vencimiento). Al registrar una compra suben el stock y el costo de los insumos. Las compras pendientes se pagan desde «Compras» y las vencidas o por vencer aparecen en Pendientes.",
  },
  {
    id: "reservas", module: "reservas", suggest: "¿Cómo anoto una reserva?",
    keys: ["anotar reserva", "anoto una reserva", "nueva reserva", "reserva nueva", "sentar", "sentado", "no vino", "se fue", "lista de espera", "turnos de servicio", "bloquear fecha"],
    text: "En Reservas tocá «Reserva nueva»: nombre, teléfono, personas, día y hora; el sistema propone las mesas libres. Cuando llegan, «Sentado» abre la cuenta en la mesa. Si no vinieron, marcás «No vino» (con dos faltas el cliente queda marcado). La lista de espera sirve para anotar a quien espera mesa. Los horarios y cupos se definen en los turnos de servicio.",
  },
  {
    id: "delivery", module: "delivery", suggest: "¿Cómo cargo un pedido de delivery?",
    keys: ["pedido de delivery", "cargar delivery", "nuevo pedido", "pedido nuevo", "zona de envio", "zonas", "costo de envio", "asignar repartidor", "repartidores", "pedido por telefono", "take away"],
    text: "En Delivery tocá «Pedido nuevo»: escribís el teléfono (si ya es cliente se completan los datos), elegís delivery o take-away, la zona (define el costo de envío) y los platos. Después lo confirmás, lo mandás a cocina y le asignás repartidor. Las zonas y los repartidores se cargan en la pestaña de configuración de esa pantalla. Cada cambio de estado queda registrado.",
  },
  {
    id: "mostrador", module: "mostrador",
    keys: ["venta rapida", "nueva venta", "listo para retirar", "avisar que esta listo", "cobrar en mostrador", "venta de mostrador"],
    text: "En Mostrador tocá «Nueva venta», cargá los platos, poné un nombre si querés y «Abrir y cobrar». Cuando el pedido está listo, «Avisar que está listo» y al entregarlo queda como entregado. Sirve para venta rápida y pedidos para llevar.",
  },
  {
    id: "personal", module: "personal", suggest: "¿Cómo ficho mi entrada?",
    keys: ["fichar", "ficho", "fichaje", "marcar entrada", "marcar salida", "mi horario", "horario del personal", "turnos del personal", "licencia", "carnet", "manipulador", "reparto de propinas", "repartir propinas"],
    text: "En Personal fichás la entrada y la salida con tu PIN personal (si no tenés PIN, pedile al dueño que te lo cargue en Usuarios). Ahí ves tu horario de la semana. Quien encarga el local arma la grilla de turnos, carga licencias y carnets de manipulador, y calcula el reparto de propinas.",
  },
  {
    id: "usuarios", module: "usuarios", roles: ["ADMINISTRADOR"], suggest: "¿Cómo creo un usuario?",
    keys: ["crear usuario", "nuevo usuario", "agregar usuario", "usuario", "usuarios", "rol", "roles", "permiso", "permisos", "pin", "empleado", "mozo nuevo", "puede cobrar", "contrasena"],
    text: "En Usuarios tocá «+ Nuevo usuario»: nombre, email para entrar y rol. Roles: Dueño (todo), Encargado (todo lo operativo, autoriza con su PIN), Mozo (mesas y comandas; cobra solo si tildás «Puede cobrar»), Cajero, Cocina (su estación) y Repartidor (solo sus entregas). Cada persona ve únicamente las pantallas de su rol.",
  },
  {
    id: "config", module: "configuracion", roles: ["ADMINISTRADOR"], suggest: "¿Dónde saco el QR de las mesas?",
    keys: ["qr", "qr de las mesas", "carta digital", "link", "enlace", "mercado pago", "horarios de atencion", "cubierto", "propina sugerida", "arqueo ciego", "datos del local", "libro de quejas", "vencimientos", "habilitacion", "mesas y salones", "cargar mesas", "plano"],
    text: "En Configuración cargás los datos del local, los horarios de atención, el cubierto y la propina sugerida, el arqueo ciego, la conexión con Mercado Pago, los vencimientos (habilitación, matafuegos…) y los links de tus webs: carta digital, reservas y pedidos online. Desde ahí también se imprimen la carta y los QR de las mesas.",
  },
  {
    id: "ayuda", tour: true, label: "Ver el recorrido",
    keys: ["recorrido", "tutorial", "como funciona", "como funcionamos", "primeros pasos", "guia", "modo oscuro", "modo claro", "tema", "oscuro", "avisos", "campanita", "notificaciones", "campana"],
    text: "El recorrido guiado te muestra dónde está cada cosa según tu rol: podés verlo cuando quieras. El modo claro u oscuro se cambia abajo del menú de la izquierda. Los avisos (platos listos, llamados de mesa, pedidos del QR) llegan con sonido y quedan en la campanita de arriba a la derecha.",
  },
];

const helpAllowed = (h: Help, c: Ctx) => (!h.module || c.can(h.module)) && (!h.roles || h.roles.includes(c.user.role));

function helpActions(h: Help): Action[] | undefined {
  if (h.tour) return [{ label: h.label || "Ver el recorrido", tour: true }];
  if (h.module) return [goto(h.module, h.label)];
  return undefined;
}

// ---------------------------------------------------------------- respuesta
async function answer(raw: string, c: Ctx): Promise<Msg> {
  const t = norm(raw);
  if (!t) return { from: "bot", text: "Escribime tu pregunta o tocá una sugerencia." };

  // saludo / gracias / chau
  if (/^(hola|holaa+|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ey|que tal)\b/.test(t) && t.split(" ").length <= 4) {
    return { from: "bot", text: "¡Hola! ¿En qué te ayudo? Podés tocar una sugerencia o escribirme, por ejemplo «mesas libres» o «cómo cobro una cuenta»." };
  }
  if (has(t, "gracias", "genial", "joya", "perfecto", "buenisimo", "excelente", "dale gracias") && t.split(" ").length <= 5) {
    return { from: "bot", text: "¡De nada! Cualquier cosa, acá estoy." };
  }
  if (/^(chau|chao|adios|hasta luego|nos vemos)\b/.test(t)) return { from: "bot", text: "¡Chau! Que tengas un buen servicio." };

  const asksHow = /^(como|donde|que hago|ayuda|ayudame|se puede|puedo|para que|que es|explicame)\b/.test(t) || has(t, "como hago", "como puedo", "como se ", "como cargo", "como abro", "como cierro", "como creo", "como cobro", "donde esta", "donde veo");
  const bestHelp = (): Help | null => {
    let best: Help | null = null, top = 0;
    for (const h of HELP) { const s = score(t, h.keys); if (s > top) { top = s; best = h; } }
    return best;
  };
  const replyHelp = (h: Help): Msg => helpAllowed(h, c)
    ? { from: "bot", text: h.text, actions: helpActions(h) }
    : { from: "bot", text: `Eso no está habilitado para tu usuario (${h.module ? moduleLabel(h.module) : "esa función"}). Si lo necesitás, pedíselo a quien administra el local.` };

  if (asksHow) {
    const h = bestHelp();
    if (h) return replyHelp(h);
  }

  // consultas con datos: gana la de más coincidencia
  let pick: Intent | null = null, top = 0;
  for (const it of INTENTS) { const s = score(t, it.keys); if (s > top) { top = s; pick = it; } }
  const h = bestHelp();
  const hs = h ? score(t, h.keys) : 0;
  if (pick && top >= hs) {
    if (!pick.allowed(c)) return { from: "bot", text: pick.denied || "Eso no está disponible para tu usuario." };
    return pick.run(c, t);
  }
  if (h) return replyHelp(h);

  const ex = INTENTS.filter((i) => i.allowed(c)).slice(0, 3).map((i) => `«${i.suggest.replace(/[¿?]/g, "").toLowerCase()}»`);
  const how = HELP.filter((x) => x.suggest && helpAllowed(x, c)).slice(0, 1).map((x) => `«${(x.suggest || "").replace(/[¿?]/g, "").toLowerCase()}»`);
  return { from: "bot", text: `No te entendí del todo. Probá con algo como ${[...ex, ...how].join(", ")}.` };
}

// ---------------------------------------------------------------- componente
function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-contrast-ignore>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

function Assistant({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // en el celular el botón se esconde al bajar la pantalla (así no tapa los botones de acción del final) y vuelve al subir
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const y = t instanceof Document ? window.scrollY : (t as HTMLElement).scrollTop;
      const prev = last.get(t);
      if (prev === undefined) { last.set(t, y); return; }
      if (Math.abs(y - prev) > 6) { setTuck(y > prev && y > 60); last.set(t, y); }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const ctx = useMemo<Ctx | null>(() => {
    if (!user) return null;
    const can = (m: string) => canAccess(user, m);
    return { user, can, seeMoney: can("caja") || can("reportes"), isBoss: ADMINS.includes(user.role) };
  }, [user]);

  const suggestions = useMemo(() => {
    if (!ctx) return [];
    const data = INTENTS.filter((i) => i.allowed(ctx)).map((i) => i.suggest);
    const how = HELP.filter((h) => h.suggest && helpAllowed(h, ctx)).map((h) => h.suggest as string);
    // primero lo del rol (datos), después un par de «cómo hago»
    return [...data.slice(0, 5), ...how.slice(0, 3)];
  }, [ctx]);

  useEffect(() => {
    if (open && msgs.length === 0 && ctx) {
      const first = (ctx.user.name || "").split(" ")[0];
      setMsgs([{ from: "bot", text: `¡Hola${first ? ` ${first}` : ""}! Soy el asistente de Restidy. Te cuento cómo está el local (mesas, cocina, caja, stock, reservas…) o te explico cómo hacer algo. Tocá una sugerencia o escribime.` }]);
    }
    if (open) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, typing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    window.setTimeout(() => fabRef.current?.focus({ preventScroll: true }), 0);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || !ctx || typing) return;
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const [reply] = await Promise.all([answer(q, ctx), new Promise((r) => setTimeout(r, 350))]);
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "bot", text: e instanceof Error ? `No pude consultar eso: ${e.message}` : "No pude consultar eso. Probá de nuevo en un momento." }]);
    } finally {
      setTyping(false);
    }
  }

  function run(a: Action) {
    const mobile = window.matchMedia("(max-width: 860px)").matches;
    if (a.tour) { setOpen(false); startTour(); return; }
    if (a.to) { navigate(a.to); if (mobile) setOpen(false); }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  if (!ctx) return null;

  return (
    <>
      {!open && (
        <button ref={fabRef} type="button" className={`rs-assist-fab ${tuck ? "is-tucked" : ""}`} onClick={() => setOpen(true)} aria-label="Abrir el asistente">
          <ChatIcon />
          <span className="rs-assist-fab-text">Asistente</span>
        </button>
      )}
      {open && (
        <section className="rs-assist" role="dialog" aria-label="Asistente de Restidy">
          <header className="rs-assist-head">
            <RestidyLogo size={34} />
            <div>
              <strong>Asistente</strong>
              <small>Consultas del local y ayuda al instante</small>
            </div>
            <button type="button" onClick={close} aria-label="Cerrar el asistente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" data-contrast-ignore><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>
          <div className="rs-assist-body" role="log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`rs-assist-msg ${m.from}`}>
                <p>{m.text}</p>
                {m.actions && (
                  <div className="rs-assist-actions">
                    {m.actions.map((a) => (
                      <button type="button" key={(a.to || "tour") + a.label} onClick={() => run(a)}>{a.label} ›</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="rs-assist-msg bot"><p className="rs-assist-typing" aria-label="Escribiendo"><span /><span /><span /></p></div>}
            <div ref={endRef} />
          </div>
          <div className="rs-assist-suggest">
            {suggestions.map((s) => (
              <button type="button" key={s} onClick={() => send(s)} disabled={typing}>{s}</button>
            ))}
          </div>
          <form className="rs-assist-input" onSubmit={submit}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Tu pregunta" autoComplete="off" enterKeyHint="send" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-contrast-ignore><path d="M4 12h15M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}

export default Assistant;
