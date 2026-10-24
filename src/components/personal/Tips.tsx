import { useEffect, useState } from "react";
import { appApi, dayKey, addDays, money, shortDate } from "../../config";
import { Empty, Field, Loading } from "../ui";
import { RULE_LABEL } from "./types";
import type { TipDist } from "./types";

/** Reparto de propinas: cálculo informativo, sin liquidación de sueldos */
export default function Tips({ boss, onFail, onOk }: { boss: boolean; onFail: (e: unknown) => void; onOk: (t: string) => void }) {
  const [list, setList] = useState<TipDist[] | null>(null);
  const [from, setFrom] = useState(dayKey(addDays(new Date(), -6)));
  const [to, setTo] = useState(dayKey(new Date()));
  const [rule, setRule] = useState("PARTES_IGUALES");
  const [preview, setPreview] = useState<TipDist | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => appApi<TipDist[]>("/tip-distributions").then(setList).catch(onFail);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function calc(save: boolean) {
    setBusy(true);
    try {
      const r = await appApi<TipDist>("/tip-distributions", { method: "POST", body: { from_day: from, to_day: to, rule, save } });
      setPreview(r); if (save) { load(); onOk("Reparto guardado"); }
    } catch (e) { onFail(e); } finally { setBusy(false); }
  }
  const table = (d: TipDist) => (
    <div className="r3-scroll"><table className="r3-table"><thead><tr><th>Persona</th><th className="num">{d.rule === "POR_HORAS" ? "Horas" : d.rule === "POR_PUNTOS" ? "Puntos" : "Parte"}</th><th className="num">Le toca</th></tr></thead>
      <tbody>{d.lines.map((l) => <tr key={l.staff_id}><td>{l.name}</td><td className="num">{l.weight.toFixed(2).replace(".", ",")}</td><td className="num"><b>{money(l.amount)}</b></td></tr>)}</tbody></table></div>
  );
  return (
    <div className="r3-page">
      <div className="rs-note rs-note-info">Es un cálculo informativo para repartir las propinas cobradas. No es una liquidación de sueldos ni tiene efecto laboral: consultalo con tu contador.</div>
      {boss && (
        <>
          <div className="r3-form">
            <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Cómo repartir"><select value={rule} onChange={(e) => setRule(e.target.value)}>{Object.entries(RULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <div className="r2-btn-row"><button className="secondary-button" disabled={busy} onClick={() => calc(false)}>Calcular</button><button className="primary-button" disabled={busy} onClick={() => calc(true)}>Calcular y guardar</button></div>
          {preview && (preview.total <= 0 ? <Empty title="No hay propinas cobradas en esas fechas" /> : <><h3>Reparto de {money(preview.total)} · {shortDate(preview.from_date)} al {shortDate(preview.to_date)}</h3>{table(preview)}</>)}
        </>
      )}
      <h3>{boss ? "Repartos guardados" : "Tus propinas"}</h3>
      {!list ? <Loading /> : list.length === 0 ? <Empty title="Todavía no hay repartos" /> : list.map((d) => (
        <div key={d.id} className="r3-courier-card"><strong>{shortDate(d.from_date)} al {shortDate(d.to_date)} · {money(d.total)}</strong><span className="r2-muted">{RULE_LABEL[d.rule]}</span>{table(d)}</div>
      ))}
    </div>
  );
}
