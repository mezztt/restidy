// Pasos del tutorial «¿Cómo funcionamos?» de Restidy, según el rol de quien entra.
// Solo se incluyen pantallas que esa persona realmente ve en su menú.
import { canAccess, splitList } from "../../config";
import type { SessionUser } from "../../config";
import type { TourStep } from "./Tour";

const nav = (m: string) => `[data-tour="nav-${m}"]`;

export function tourSteps(user: SessionUser | null): TourStep[] {
  if (!user) return [];
  const can = (m: string) => canAccess(user, m);
  const steps: TourStep[] = [];
  const add = (cond: boolean, s: TourStep) => { if (cond) steps.push(s); };
  const role = user.role;
  const has = (m: string) => splitList(user.enabled_modules).includes(m);
  const theme: TourStep = { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo. En el salón con poca luz, el oscuro descansa la vista." };
  const help: TourStep = { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." };

  // ---------- recorridos cortos por rol operativo ----------
  if (role === "MOZO") {
    add(true, { title: "Bienvenido a Restidy", text: "Este es tu espacio como mozo: tus mesas, los pedidos y los avisos de cocina. En un minuto te mostramos dónde está cada cosa." });
    add(can("salon"), { selector: nav("salon"), title: "Salón", text: "El plano de mesas con su estado: libre, ocupada, pidió la cuenta. Tocá una mesa para abrirla y cargar el pedido." });
    add(can("cocina"), { selector: nav("cocina"), title: "Cocina y barra", text: "Mirá qué platos ya están listos para llevar a la mesa." });
    add(can("reservas"), { selector: nav("reservas"), title: "Reservas", text: "La agenda del día y la lista de espera. Cuando llega una reserva, sentala en su mesa y se abre la cuenta sola." });
    add(can("clientes"), { selector: nav("clientes"), title: "Clientes", text: "Ficha del cliente con sus gustos y alergias, para atenderlo mejor." });
    add(can("personal"), { selector: nav("personal"), title: "Personal", text: "Tu horario de la semana y el botón para fichar la entrada y la salida con tu PIN." });
    add(true, { selector: '[data-tour="bell"]', title: "Avisos", text: "Acá te llegan los avisos: platos listos, llamados de mesa, pedidos hechos desde el QR para confirmar y novedades del turno." });
    add(true, theme);
    add(true, help);
    return steps;
  }
  if (role === "COCINA") {
    add(true, { title: "Bienvenido a Restidy", text: "Este es tu espacio en la cocina: las comandas que entran, en el orden en que hay que prepararlas." });
    add(can("cocina"), { selector: nav("cocina"), title: "Cocina y barra", text: "Las comandas llegan a tu estación. Marcalas en preparación y listas, y el salón se entera al instante." });
    add(can("carta"), { selector: nav("carta"), title: "Carta", text: "Pausá un plato cuando se acaba el ingrediente, para que nadie lo pida." });
    add(can("delivery"), { selector: nav("delivery"), title: "Delivery", text: "Los pedidos de delivery y para retirar que están en cocina, con la hora prometida." });
    add(can("personal"), { selector: nav("personal"), title: "Personal", text: "Tu horario de la semana y el botón para fichar con tu PIN." });
    add(true, { selector: '[data-tour="bell"]', title: "Avisos", text: "Acá te llegan los avisos del turno." });
    add(true, theme);
    add(true, help);
    return steps;
  }
  if (role === "REPARTIDOR") {
    add(true, { title: "Bienvenido a Restidy", text: "Este es tu espacio como repartidor: los pedidos que te asignaron para entregar." });
    add(can("delivery"), { selector: nav("delivery"), title: "Delivery", text: "Tus entregas con la dirección y el monto a cobrar. Marcá cada una como en camino y entregada." });
    add(can("personal"), { selector: nav("personal"), title: "Personal", text: "Tu horario y el botón para fichar la entrada y la salida con tu PIN." });
    add(true, theme);
    add(true, help);
    return steps;
  }

  // ---------- dueño, encargado y caja ----------
  const who = role === "CAJERO" ? "Desde acá cobrás, abrís y cerrás la caja y atendés el mostrador."
    : role === "ENCARGADO" ? "Desde acá manejás el servicio del día: salón, cocina, caja y el equipo."
    : "Desde acá manejás todo el local: servicio, carta, stock, equipo y configuración.";
  add(true, { title: "Bienvenido a Restidy", text: `${who} Te mostramos lo principal en un minuto.` });
  add(true, { selector: '[data-tour="pendientes"]', title: "Pendientes", text: "En Inicio ves lo que hay para resolver ahora: cajas abiertas, pedidos demorados, stock bajo y más. Tocá uno y vas directo a esa pantalla." });
  add(can("salon"), { selector: nav("salon"), title: "Salón", text: "El plano de mesas con su estado. Abrí una mesa, cargá el pedido, dividí la cuenta y cobrá." });
  add(can("cocina"), { selector: nav("cocina"), title: "Cocina y barra", text: "Las comandas por estación, en tiempo real, con las alertas de alérgenos bien a la vista." });
  add(can("mostrador"), { selector: nav("mostrador"), title: "Mostrador", text: "Venta rápida y pedidos para llevar: cargás los productos, cobrás y avisás cuando el pedido está listo para retirar." });
  add(can("caja"), { selector: nav("caja"), title: "Caja", text: "Abrí el turno con el efectivo inicial, cobrá (podés dividir la cuenta y dejar propina aparte), anotá gastos y retiros y cerrá con arqueo. Los tickets son internos: Documento no válido como factura." });
  add(can("carta"), { selector: nav("carta"), title: "Carta", text: "Categorías, productos, variantes, adicionales, combos y alérgenos, con precios por horario (happy hour). Es la base de todo lo demás." });
  add(can("stock"), { selector: nav("stock"), title: "Stock y recetas", text: "Insumos, recetas y costo de cada plato con semáforo de margen, mermas e inventario, para saber cuánto ganás con cada uno." });
  add(can("compras"), { selector: nav("compras"), title: "Compras", text: "Proveedores, pedidos, recepción de mercadería con el costo real y la cuenta corriente de lo que debés." });
  add(can("delivery"), { selector: nav("delivery"), title: "Delivery", text: "Pedidos por teléfono, mostrador o web en un tablero por estado, con zonas de envío, repartidores y la hora prometida. El cobro lo hace Caja." });
  add(can("reservas"), { selector: nav("reservas"), title: "Reservas", text: "La agenda del día, los turnos con cupo por horario, la seña opcional por Mercado Pago y la lista de espera. Con dos «no vino», el cliente queda marcado." });
  add(can("personal"), { selector: nav("personal"), title: "Personal", text: "Turnos de la semana, asistencia con PIN, vencimiento de carnets de manipulador y reparto informativo de propinas. No liquida sueldos." });
  add(can("clientes"), { selector: nav("clientes"), title: "Clientes", text: "Ficha, historial de consumo, cuenta corriente y niveles de fidelización. Las alergias son datos de salud: se guardan solo con consentimiento." });
  add(can("reportes"), { selector: nav("reportes"), title: "Reportes", text: "Ventas, ticket promedio, platos más rentables, horas pico, mozos y caja, con exportación a CSV. Las propinas van siempre aparte de las ventas." });
  add(true, theme);
  const webs = [has("web_carta") && "carta con QR por mesa (se pide solo con la mesa abierta por el mozo)", has("web_reservas") && "reservas online", has("web_pedidos") && "pedidos online con seguimiento"].filter(Boolean).join(", ");
  if (can("configuracion")) add(true, { selector: nav("configuracion"), title: "Configuración", text: `Datos del local, impuestos, propinas, plano de mesas con sus QR y vencimientos de habilitaciones.${webs ? ` Acá están los enlaces de tus páginas públicas: ${webs}.` : ""} Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido.` });
  else add(true, help);
  return steps;
}

/** Recorrido del panel general de Mezztt (superadmin) */
export function adminTourSteps(): TourStep[] {
  const a = (p: string) => `[data-tour="admin-${p}"]`;
  return [
    { title: "Bienvenido al panel de Restidy", text: "Desde acá administrás los locales que usan Restidy: qué módulos tienen habilitados, cuánto pagan y cómo se factura. Te mostramos lo principal." },
    { selector: a("inicio"), title: "Inicio", text: "El resumen: cuántos locales hay, qué se espera cobrar este mes, cuánto ya entró y los pedidos de baja pendientes." },
    { selector: a("sistemas"), title: "Sistemas", text: "Cada cliente es un sistema. Acá lo das de alta, elegís sus módulos (los que dependen de otros se marcan solos), el abono y podés resetear contraseñas." },
    { selector: a("pagos"), title: "Pagos", text: "Registrá lo que te paga cada cliente y mirá quién está al día y quién debe." },
    { selector: a("facturacion"), title: "Facturación", text: "Cotizaciones con pago inicial y abono mensual (más los planes trimestral y anual) y las facturas mensuales de cada sistema." },
    { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." },
    { selector: a("configuracion"), title: "Configuración", text: "Precios, enlaces de marca y copia de seguridad. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." },
  ];
}
