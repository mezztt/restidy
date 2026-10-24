import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { publicApi, money } from "../../config";
import { Shell } from "../../components/public/Shell";
import type { MenuData, MenuProduct, Venue } from "../../components/r3/types";

type PubMenu = MenuData & { venue: Venue; can_order_from_table: boolean };

export function ProductRow({ p, action }: { p: MenuProduct; action?: ReactNode }) {
  const from = p.variants.length > 1 ? Math.min(...p.variants.map((v) => v.price)) : p.price_now;
  return (
    <div className={`r3-pub-item ${p.sold_out ? "is-out" : ""}`}>
      <div>
        <strong>{p.name}</strong>
        {p.description && <p>{p.description}</p>}
        <div className="r3-pub-tags">
          {p.sin_tacc && <span className="r2-tag r2-tag-green">Sin TACC</span>}
          {p.vegan && <span className="r2-tag r2-tag-green">Vegano</span>}
          {!p.vegan && p.vegetarian && <span className="r2-tag r2-tag-green">Vegetariano</span>}
          {p.alcohol && <span className="r2-tag r2-tag-orange">Contiene alcohol</span>}
          {p.sold_out && <span className="r2-tag r2-tag-gray">Agotado</span>}
        </div>
        {p.allergen_text && <div className="r3-pub-allergens">{p.allergen_text}</div>}
        {p.variants.length > 1 && <div className="r3-pub-allergens">{p.variants.map((v) => `${v.name} ${money(v.price)}`).join(" · ")}</div>}
      </div>
      <div style={{ textAlign: "right" }}><span className="price">{p.variants.length > 1 ? "Desde " : ""}{money(from)}</span>{action}</div>
    </div>
  );
}

/** Filtros por alérgeno y dieta (compartido con la carta de la mesa) */
export function MenuFilters({ data, tacc, setTacc, vegan, setVegan, excl, setExcl }: {
  data: MenuData; tacc: boolean; setTacc: (v: boolean) => void; vegan: boolean; setVegan: (v: boolean) => void; excl: string[]; setExcl: (v: string[]) => void;
}) {
  return (
    <div className="pb-card">
      <span className="pb-step-label">Filtrar la carta</span>
      <div className="r3-pub-tools">
        <button type="button" className={`r3-pub-chip ${tacc ? "is-on" : ""}`} aria-pressed={tacc} onClick={() => setTacc(!tacc)}>Sin TACC</button>
        <button type="button" className={`r3-pub-chip ${vegan ? "is-on" : ""}`} aria-pressed={vegan} onClick={() => setVegan(!vegan)}>Vegano</button>
      </div>
      <p className="r3-pub-legal" style={{ margin: "0 0 6px" }}>Sacar los platos que contienen:</p>
      <div className="r3-pub-tools">
        {data.allergen_catalog.map((a) => (
          <button key={a.code} type="button" className={`r3-pub-chip ${excl.includes(a.code) ? "is-on" : ""}`} aria-pressed={excl.includes(a.code)}
            onClick={() => setExcl(excl.includes(a.code) ? excl.filter((x) => x !== a.code) : [...excl, a.code])}>{a.name.split(" (")[0]}</button>
        ))}
      </div>
      {(excl.length > 0 || tacc) && <p className="r3-pub-legal">Solo se muestran los platos con los alérgenos declarados por el local. {data.hidden_count ? `Ocultamos ${data.hidden_count} plato${data.hidden_count === 1 ? "" : "s"}.` : ""}</p>}
    </div>
  );
}

export default function Carta() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PubMenu | null>(null);
  const [error, setError] = useState("");
  const [tacc, setTacc] = useState(false);
  const [vegan, setVegan] = useState(false);
  const [excl, setExcl] = useState<string[]>([]);

  useEffect(() => {
    publicApi<PubMenu>(`/public/${slug}/menu?sin_tacc=${tacc ? 1 : 0}&vegano=${vegan ? 1 : 0}&excluir=${excl.join(",")}`)
      .then((d) => { setData(d); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar la carta"));
  }, [slug, tacc, vegan, excl]);

  return (
    <Shell title="Carta" venue={data?.venue || null} heading="Nuestra carta" intro="Mirá los platos, precios y alérgenos. Para pedir, avisale al mozo." error={error && !data ? error : undefined}>
      {data && (
        <>
          {data.alcohol_notice && <div className="r3-pub-notice">{data.alcohol_notice}</div>}
          {(data.has_sin_tacc || data.allergen_catalog.length > 0) && <MenuFilters data={data} tacc={tacc} setTacc={setTacc} vegan={vegan} setVegan={setVegan} excl={excl} setExcl={setExcl} />}
          {error && <div className="pb-error" role="alert">{error}</div>}
          {data.categories.length === 0 ? <div className="pb-card"><div className="pb-soon"><b>No hay platos para mostrar</b>{tacc || vegan || excl.length ? "Probá con menos filtros." : "La carta todavía no está cargada."}</div></div> : (
            data.categories.map((c) => (
              <section key={c.id} className="pb-card r3-pub-cat"><h3>{c.name}</h3>{c.products.map((p) => <ProductRow key={p.id} p={p} />)}</section>
            ))
          )}
          <p className="r3-pub-legal">{data.disclaimer}</p>
        </>
      )}
      {!data && !error && <div className="pb-card"><div className="pb-soon"><b>Cargando la carta...</b></div></div>}
    </Shell>
  );
}
