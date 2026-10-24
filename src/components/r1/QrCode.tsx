import { useMemo } from "react";
import { qrMatrix } from "./qr";

/** Código QR en SVG (se imprime nítido a cualquier tamaño) */
export default function QrCode({ text, label }: { text: string; label?: string }) {
  const m = useMemo(() => { try { return qrMatrix(text); } catch { return null; } }, [text]);
  if (!m) return <div className="rs-note rs-note-error">El link es demasiado largo para el QR.</div>;
  const n = m.length, q = 3;
  let d = "";
  m.forEach((row, y) => row.forEach((c, x) => { if (c) d += `M${x + q} ${y + q}h1v1h-1z`; }));
  return (
    <svg viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} role="img" aria-label={label || "Código QR"} shapeRendering="crispEdges">
      <rect width={n + q * 2} height={n + q * 2} fill="#ffffff" /><path d={d} fill="#000000" />
    </svg>
  );
}

/** El link del QR puede venir como ruta (/m/slug/token): se completa con la dirección desde la que se usa el sistema */
export function fullUrl(u: string): string { return u.startsWith("/") ? window.location.origin + u : u; }
