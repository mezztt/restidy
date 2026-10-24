import { useEffect } from "react";
import { Link } from "react-router-dom";
import { APP_NAME } from "../../config";
import { RestidyLogo, PoweredBy, useLightPage } from "../../components/Brand";

/**
 * Esqueleto de las páginas públicas del local (carta, reservas, pedidos, seguimiento).
 * Cada agente de web_* reemplaza el archivo que le toca y deja de usar este componente.
 */
export default function PublicStub({ title, subtitle, note }: { title: string; subtitle: string; note?: string }) {
  useLightPage();
  useEffect(() => { document.title = `${title} · ${APP_NAME}`; }, [title]);
  return (
    <div className="pb-page">
      <header className="pb-hero">
        <div className="pb-wrap">
          <div className="pb-top"><RestidyLogo size={38} /><div><strong>{APP_NAME}</strong><small>{subtitle}</small></div></div>
          <h1>{title}</h1>
          <p>Esta página se está armando y va a estar disponible muy pronto.</p>
        </div>
      </header>
      <main className="pb-wrap pb-main">
        <div className="pb-card">
          <span className="pb-step-label">En construcción</span>
          <h2>{title}</h2>
          <p>{note || "Volvé a intentar en unos días."}</p>
          <p className="pb-consent">Al usar esta página aceptás los <Link to="/legal/terminos">Términos</Link> y la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
        </div>
      </main>
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}
