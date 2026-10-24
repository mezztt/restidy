// Carta lista para imprimir (A4): categorías, precios de ahora, alérgenos y las leyendas legales
import { useEffect, useState } from "react";
import { appApi, money } from "../../config";
import { Loading } from "../../components/ui";
import "../../r1.css";
import { useLightPage } from "./usePrintPage";

interface MProduct { id: number; name: string; description: string | null; price_now: number; sold_out: boolean; alcohol: boolean; sin_tacc: boolean; is_vegan: boolean; is_vegetarian: boolean; allergen_text: string; variants: { id: number; name: string; price_now: number }[] }
interface MCat { id: number; name: string; products: MProduct[] }
interface Legal { alcohol: string; allergy: string; cover: string | null; cover_amount: number }

export default function PrintCarta() {
  useLightPage();
  const [cats, setCats] = useState<MCat[] | null>(null);
  const [legal, setLegal] = useState<Legal | null>(null);
  const [company, setCompany] = useState("");
  const [onlyTacc, setOnlyTacc] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([appApi<MCat[]>("/menu?channel=SALON"), appApi<Legal>("/carta/legal"), appApi<{ name: string }>("/company")])
      .then(([m, l, c]) => { setCats(m); setLegal(l); setCompany(c.name); }).catch((e) => setErr(e instanceof Error ? e.message : "No se pudo cargar la carta"));
  }, []);
  if (err) return <div className="r1-print"><div className="rs-note rs-note-error">{err}</div></div>;
  if (!cats || !legal) return <div className="r1-print"><Loading /></div>;
  const shown = cats.map((c) => ({ ...c, products: c.products.filter((p) => (showAll || !p.sold_out) && (!onlyTacc || p.sin_tacc)) })).filter((c) => c.products.length);
  const hasAlcohol = cats.some((c) => c.products.some((p) => p.alcohol));
  const hasTacc = shown.some((c) => c.products.some((p) => p.sin_tacc));
  return (
    <div className="r1-print">
      <div className="r1-print-bar">
        <div className="rs-row" style={{ color: "#111", gap: 16 }}>
          <label className="rs-row" style={{ gap: 6 }}><input type="checkbox" checked={onlyTacc} onChange={(e) => setOnlyTacc(e.target.checked)} /> Solo opciones sin TACC</label>
          <label className="rs-row" style={{ gap: 6 }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Incluir agotados</label>
        </div>
        <button className="primary-button" onClick={() => window.print()}>Imprimir</button>
      </div>
      <div className="r1-sheet">
        <h1>{company}</h1>
        <p className="sub">{onlyTacc ? "Carta sin TACC" : "Carta"}</p>
        {!shown.length && <p style={{ textAlign: "center" }}>No hay productos para imprimir con estas opciones.</p>}
        {shown.map((c) => (
          <section key={c.id}>
            <h2>{c.name}</h2>
            {c.products.map((p) => (
              <div key={p.id} className="item">
                <div style={{ flex: "0 1 auto", maxWidth: "70%" }}>
                  <span className="n">{p.name}{p.sin_tacc && <span className="tag">SIN TACC</span>}{p.is_vegan ? <span className="tag">VEGANO</span> : p.is_vegetarian ? <span className="tag">VEGETARIANO</span> : null}{p.sold_out && <span className="tag">AGOTADO</span>}</span>
                  {p.description && <span className="d">{p.description}</span>}
                  <span className="d">{p.allergen_text}</span>
                </div>
                <span className="dots" />
                <span className="p">{p.variants.length > 1 ? p.variants.map((v) => `${v.name} ${money(v.price_now)}`).join(" · ") : money(p.price_now)}</span>
              </div>))}
          </section>))}
        <div className="legal">
          {legal.cover && <p style={{ margin: "0 0 6px" }}>{legal.cover}{legal.cover_amount ? ` (${money(legal.cover_amount)} por persona)` : ""}</p>}
          <p style={{ margin: "0 0 6px" }}>Precios en pesos argentinos, IVA incluido. {legal.allergy}</p>
          {hasTacc && <p style={{ margin: "0 0 6px" }}>«Sin TACC» es una declaración del local sobre la elaboración del plato; no es una certificación. Consultá al personal antes de pedir si sos celíaco.</p>}
          {hasAlcohol && <p style={{ margin: "0 0 6px" }}><strong>{legal.alcohol}.</strong></p>}
          <p style={{ margin: 0 }}>Documento no válido como factura.</p>
        </div>
      </div>
    </div>
  );
}
