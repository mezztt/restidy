import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_BRAND, APP_NAME } from "../../config";
import { InstagramLink, MezzttLink, RestidyLogo, PoweredBy, useBrandLinks, useLightPage } from "../../components/Brand";

/**
 * Textos legales públicos (sin login): /legal/terminos y /legal/privacidad.
 * Son textos generales del servicio; no reemplazan el asesoramiento de un profesional (ver LEGAL.md).
 */
const UPDATED = "octubre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="lg-section"><h2>{title}</h2>{children}</section>;
}

function Contact() {
  const links = useBrandLinks();
  return (
    <p className="lg-contact">
      Escribinos por el Instagram de <MezzttLink />
      <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
    </p>
  );
}

function Terminos() {
  return (
    <>
      <p className="lg-lead">
        Estas son las condiciones para usar {APP_NAME}. Están escritas en lenguaje simple. Si usás el sistema, entendemos que las aceptás.
      </p>
      <Section title="1. Qué es Restidy">
        <p>{APP_NAME} es un sistema de gestión para restaurantes, bares, cafeterías y locales gastronómicos: carta, salón y mesas, cocina, mostrador, caja, delivery, reservas, stock, compras, personal y clientes, según los módulos que cada local contrate. Puede incluir páginas públicas del local: carta por QR, reservas y pedidos online.</p>
      </Section>
      <Section title="2. Quién presta el servicio">
        <p>El servicio lo presta {APP_BRAND}, que desarrolla y mantiene el sistema. El cliente es el local gastronómico que lo contrata, y es quien decide qué personas de su equipo tienen usuario y qué puede hacer cada una.</p>
      </Section>
      <Section title="3. Cuenta, contraseñas y PIN">
        <ul>
          <li>Cada usuario es personal. No compartas tu contraseña ni tu PIN.</li>
          <li>El PIN autoriza acciones sensibles (anulaciones, descuentos, cortesías) y queda registrado junto con quién lo usó.</li>
          <li>El cliente es responsable de lo que se hace con los usuarios que crea y de darlos de baja cuando alguien deja de trabajar con él.</li>
          <li>Si creés que alguien entró con tu usuario, cambiá la contraseña y avisanos.</li>
        </ul>
      </Section>
      <Section title="4. Uso permitido">
        <ul>
          <li>El sistema es para la actividad comercial del cliente. No se puede usar para fines ilegales ni para cargar datos de personas sin tener derecho a hacerlo.</li>
          <li>No está permitido intentar entrar a datos de otros clientes, copiar el sistema ni afectar su funcionamiento.</li>
          <li>{APP_NAME} es una herramienta de registro y organización. Lo que se informa en la carta (precios, ingredientes, alérgenos) es responsabilidad del local.</li>
        </ul>
      </Section>
      <Section title="5. Alérgenos e información de la carta">
        <p>{APP_NAME} permite marcar alérgenos y alertas en los productos y mostrarlos en la carta y en la comanda. La información la carga el local: {APP_BRAND} no verifica su exactitud ni reemplaza los controles de la cocina. Ante una consulta de un comensal sobre alergias, la respuesta final es del local.</p>
      </Section>
      <Section title="6. Comprobantes y facturación">
        <ul>
          <li>{APP_NAME} <b>no emite</b> comprobantes fiscales de ARCA. Los tickets, precuentas, comandas, cierres y recibos que imprime son documentos internos: <b>Documento no válido como factura</b>.</li>
          <li>La facturación electrónica y los impuestos del local son responsabilidad del local y de su contador.</li>
        </ul>
      </Section>
      <Section title="7. Pagos con Mercado Pago">
        <p>Si el local conecta su cuenta de Mercado Pago para cobrar pedidos online, el cobro se procesa en Mercado Pago, con las credenciales del propio local. {APP_NAME} no guarda datos de tarjetas. Las comisiones, contracargos y devoluciones son una relación entre el local, el comensal y Mercado Pago.</p>
      </Section>
      <Section title="8. Abono y baja del servicio">
        <ul>
          <li>El servicio tiene un pago inicial y un abono mensual según los módulos contratados, acordados con {APP_BRAND} antes de empezar. Los módulos que dependen de otros incluyen lo necesario para funcionar, y eso se informa en la cotización.</li>
          <li>Podés pedir la baja cuando quieras, con el botón «Dar de baja el servicio» (en la pantalla de ingreso y en Configuración), sin trámites adicionales, de acuerdo con la Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial (Ministerio de Economía). También podés ejercer el arrepentimiento dentro de los plazos legales.</li>
          <li>Si el abono queda impago, el acceso puede suspenderse después de avisarte. Los datos no se borran por eso.</li>
        </ul>
      </Section>
      <Section title="9. Tus datos son tuyos">
        <p>Los datos que el cliente carga en el sistema son del cliente (y de sus comensales y empleados, según la ley). Podés pedirnos una copia en cualquier momento, también al darte de baja. Cómo los cuidamos está explicado en la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
      </Section>
      <Section title="10. Disponibilidad">
        <p>Trabajamos para que el sistema esté disponible todo el tiempo y hacemos copias de seguridad, pero no podemos garantizar que nunca haya cortes: pueden existir interrupciones por mantenimiento, por fallas de internet o de los proveedores de alojamiento. Conviene tener un plan de respaldo para el servicio (por ejemplo, comandas en papel) ante un corte.</p>
      </Section>
      <Section title="11. Responsabilidad">
        <p>{APP_BRAND} responde por el funcionamiento del sistema dentro de lo razonable. No responde por datos mal cargados, por decisiones comerciales o sanitarias tomadas con esos datos, ni por el uso del sistema fuera de estas condiciones. La relación con los comensales, empleados y proveedores es del local.</p>
      </Section>
      <Section title="12. Cambios">
        <p>Podemos mejorar el sistema y actualizar estas condiciones. Si el cambio es importante, te avisamos antes.</p>
      </Section>
      <Section title="13. Ley aplicable">
        <p>Estas condiciones se rigen por las leyes de la República Argentina.</p>
      </Section>
      <Section title="14. Contacto"><Contact /></Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className="lg-lead">
        Acá te contamos qué datos personales se guardan en {APP_NAME}, para qué se usan y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.
      </p>
      <Section title="1. Quién es responsable de los datos">
        <ul>
          <li>El <b>local gastronómico</b> que usa {APP_NAME} es el responsable de su base de datos: decide qué datos carga y para qué.</li>
          <li><b>{APP_BRAND}</b> presta el software y guarda esos datos por cuenta del local. No los usa para otra cosa.</li>
        </ul>
      </Section>
      <Section title="2. Qué datos se guardan y para qué">
        <ul>
          <li><b>Comensales y clientes:</b> nombre, teléfono, email y, si hacen un pedido de delivery, la dirección de entrega. Sirven para atender reservas y pedidos y para avisarte de su estado.</li>
          <li><b>Reservas:</b> nombre, teléfono, cantidad de personas, fecha y hora, y las observaciones que quieras dejar.</li>
          <li><b>Empleados y usuarios:</b> nombre, email, rol y los datos necesarios para turnos, asistencia y propinas.</li>
          <li><b>Uso del sistema:</b> se registra quién hace acciones sensibles (anulaciones, descuentos, cierres de caja) para cuidar la operación del local.</li>
        </ul>
      </Section>
      <Section title="3. Alergias y preferencias alimentarias">
        <p>Si indicás una alergia, una intolerancia o una restricción alimentaria en una reserva o en un pedido, es información sobre tu salud y la tratamos como <b>dato sensible</b> (Ley 25.326): se usa solo para que el local prepare tu pedido de forma segura y no se usa para publicidad. Podés pedir que se borre.</p>
      </Section>
      <Section title="4. Si reservás o pedís por la web">
        <p>Te pedimos nombre, teléfono y lo necesario para tu reserva o tu pedido. Esos datos los recibe el local que elegiste, solo para gestionarlo y avisarte. Si pagás online, el pago se hace en Mercado Pago: {APP_NAME} no ve ni guarda los datos de tu tarjeta. Para consultar tu pedido o tu reserva usás un enlace con un código único, sin crear cuenta.</p>
      </Section>
      <Section title="5. No se venden ni se ceden">
        <p>Los datos no se venden, no se alquilan y no se entregan a terceros para publicidad. Solo se comparten cuando lo exige la ley o una orden judicial, o con los proveedores técnicos necesarios para que el sistema funcione (alojamiento y, si el local lo activa, Mercado Pago), que están obligados a mantener la confidencialidad. {APP_NAME} no envía mensajes por WhatsApp ni mails por su cuenta: los avisos al comensal los hace el local.</p>
      </Section>
      <Section title="6. Tus derechos">
        <p>Podés pedir <b>acceso</b> a tus datos, que se <b>rectifiquen</b> o <b>actualicen</b> si están mal, y que se <b>supriman</b> cuando corresponda.</p>
        <p>El pedido se hace ante el local donde reservaste o pediste, que es el responsable de la base. Si no sabés a quién dirigirte, escribinos y te orientamos.</p>
      </Section>
      <Section title="7. Seguridad">
        <p>Las contraseñas y los PIN se guardan cifrados, la conexión es segura (https), cada cliente ve solo sus propios datos, las acciones sensibles quedan registradas y se hacen copias de seguridad. Ningún sistema es infalible: si detectamos un problema que afecte tus datos, se lo avisamos al responsable.</p>
      </Section>
      <Section title="8. Cookies y seguimiento">
        <p>{APP_NAME} no usa cookies de publicidad ni rastreadores de terceros. Solo guarda en tu navegador lo necesario para mantener tu sesión y tu preferencia de modo claro u oscuro.</p>
      </Section>
      <Section title="9. Órgano de control">
        <p className="lg-quote">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      </Section>
      <Section title="10. Contacto"><Contact /></Section>
    </>
  );
}

const DOCS = {
  terminos: { title: "Términos y condiciones", other: "privacidad", otherLabel: "Política de privacidad", Body: Terminos },
  privacidad: { title: "Política de privacidad", other: "terminos", otherLabel: "Términos y condiciones", Body: Privacidad },
} as const;

function Legal({ doc }: { doc: keyof typeof DOCS }) {
  useLightPage();
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.title} · ${APP_NAME}`; window.scrollTo(0, 0); }, [d.title]);
  return (
    <div className="pb-page lg-page">
      <header className="lg-top">
        <div className="lg-wrap lg-top-row">
          <span className="lg-brand"><RestidyLogo size={34} /><strong>{APP_NAME}</strong></span>
          <button type="button" className="lg-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>‹ Volver</button>
        </div>
      </header>
      <main className="lg-wrap">
        <article className="pb-card lg-card">
          <span className="pb-step-label">Legales</span>
          <h1>{d.title}</h1>
          <p className="lg-updated">Última actualización: {UPDATED}</p>
          <d.Body />
          <p className="lg-also">Leé también: <Link to={`/legal/${d.other}`}>{d.otherLabel}</Link></p>
        </article>
      </main>
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Legal;
