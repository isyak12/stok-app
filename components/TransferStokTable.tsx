"use client";

import { ArrowRightLeft } from "lucide-react";
import { TransferStok, Cabang } from "@/lib/types";

type Props = {
  data: TransferStok[];
  daftarCabang: Cabang[];
};

function formatTanggal(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function TransferStokTable({ data, daftarCabang }: Props) {
  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  return (
    <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Dari</th>
            <th className="px-4 py-3 font-medium">Ke</th>
            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
            <th className="px-4 py-3 font-medium">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <tr
              key={t.id}
              className="border-b border-ink/5 last:border-0 hover:bg-paper/50"
            >
              <td className="px-4 py-3 text-ink/70 font-mono text-xs whitespace-nowrap">
                {formatTanggal(t.dibuatPada)}
              </td>
              <td className="px-4 py-3">{namaCabang(t.dariCabangId)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  <ArrowRightLeft size={12} className="text-ink/40" />
                  {namaCabang(t.keCabangId)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono">{t.jumlah}</td>
              <td className="px-4 py-3 text-ink/70">
                {t.catatan || <span className="text-ink/30">—</span>}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-ink/40 text-sm">
                Belum ada transfer stok untuk barang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
