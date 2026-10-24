import { useEffect, useState } from "react";
import { appApi } from "../../config";
import { Empty, Loading, Modal } from "../ui";
import type { MenuData } from "./types";

interface Prod { id: number; name: string; category: string; sold_out: boolean }

/**
 * «86»: marcar un plato como agotado en un toque (o «solo por hoy», que vuelve solo a la medianoche).
 * Desde cocina usa la carta de la estación; desde el salón y el mostrador, la carta que se vende en ese canal.
 */
export default function EightySix({ source, station = 0, channel = "SALON", onClose, onFail, onOk }: {
  source: "kds" | "salon"; station?: number; channel?: "SALON" | "MOSTRADOR";
  onClose: () => void; onFail: (e: unknown) => void; onOk: (m: string) => void;
}) {
  const [rows, setRows] = useState<Prod[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (source === "kds") {
      appApi<Prod[]>(`/kds/products?station_id=${station}`).then(setRows).catch(onFail);
    } else {
      appApi<MenuData>(`/salon/menu?channel=${channel}`)
        .then((m) => setRows(m.categories.flatMap((c) => c.products.map((p) => ({ id: p.id, name: p.name, category: c.name, sold_out: p.sold_out })))))
        .catch(onFail);
    }
  }, [source, station, channel, onFail]);
  async function flip(p: Prod, untilClose: boolean) {
    try {
      const path = source === "kds" ? `/kds/products/${p.id}/sold-out` : `/salon/products/${p.id}/sold-out`;
      await appApi(path, { method: "PATCH", body: { sold_out: !p.sold_out, until_close: !p.sold_out && untilClose } });
      setRows((rs) => (rs || []).map((x) => (x.id === p.id ? { ...x, sold_out: !x.sold_out } : x)));
      onOk(p.sold_out ? `${p.name} volvió a la carta` : `${p.name} marcado como agotado`);
    } catch (e) { onFail(e); }
  }
  const list = (rows || []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal eyebrow="86" title="Platos agotados" onClose={onClose}>
      <div className="r2-dialog">
        <input className="rs-search" type="search" placeholder="Buscar un plato" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar un plato" />
        {!rows ? <Loading /> : list.length === 0 ? <Empty title="No hay platos para mostrar" /> : (
          <div className="r2-86-list">
            {list.map((p) => (
              <div key={p.id} className="r2-86-row"><div><strong>{p.name}</strong><small>{p.category}{p.sold_out ? " · agotado" : ""}</small></div>
                <div className="r2-btn-row">
                  {p.sold_out ? <button className="r2-mini is-ok" onClick={() => flip(p, false)}>Volvió</button> : (
                    <><button className="r2-mini is-danger" onClick={() => flip(p, true)}>Agotado hoy</button><button className="r2-mini" onClick={() => flip(p, false)}>Agotado</button></>)}
                </div></div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
