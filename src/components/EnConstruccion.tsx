import { PageHeader } from "./ui";
import { MODULE_HINTS, MODULE_LABELS } from "../config";

/**
 * Pantalla provisoria de cada módulo mientras se arma (fase 2).
 * Cada agente reemplaza el contenido de `pages/app/<modulo>/Index.tsx` y deja de usar este componente.
 */
export default function EnConstruccion({ module, eyebrow }: { module: string; eyebrow?: string }) {
  return (
    <section className="products-page" data-module={module}>
      <PageHeader eyebrow={eyebrow || "MÓDULO"} title={MODULE_LABELS[module] || module} subtitle={MODULE_HINTS[module]} />
      <div className="rs-empty">
        <strong>En construcción</strong>
        Esta pantalla se está armando y va a estar disponible muy pronto.
      </div>
    </section>
  );
}
