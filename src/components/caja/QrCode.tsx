import { useMemo } from "react";
import { qrMatrix } from "../r1/qr";

/** Código QR en SVG (se genera en el navegador, sin servicios externos) */
export default function QrCode({ text, label }: { text: string; label: string }) {
  const m = useMemo(() => { try { return qrMatrix(text); } catch { return null; } }, [text]);
  if (!m) return <div className="rs-note rs-note-warn">El link es muy largo para mostrarlo como QR. Copialo y mandalo por mensaje.</div>;
  const n = m.length, q = 2;
  const d: string[] = [];
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d.push(`M${x + q} ${y + q}h1v1h-1z`); }));
  return (
    <div className="r2-qr">
      <svg viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <rect width="100%" height="100%" fill="#fff" />
        <path d={d.join("")} fill="#000" />
      </svg>
    </div>
  );
}
