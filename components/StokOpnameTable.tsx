"use client";

import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { Cabang, StokOpname } from "@/lib/types";

type Props = {
  data: StokOpname[];
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

export default function StokOpnameTable({ data, daftarCabang }: Props) {
  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  return (
    <div className="bg-white border border-ink/10 rounded-sm overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Cabang</th>
            <th className="px-4 py-3 font-medium text-right">
              Stok Sistem
            </th>
            <th className="px-4 py-3 font-medium text-right">Stok Fisik</th>
            <th className="px-4 py-3 font-medium text-right">Selisih</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Alasan / Catatan
            </th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Dicatat oleh
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((o) => {
            const cocok = o.selisih === 0;
            return (
              <tr
                key={o.id}
                className="border-b border-ink/5 last:border-0 hover:bg-paper/50"
              >
                <td className="px-4 py-3 text-ink/70 font-mono text-xs whitespace-nowrap">
                  {formatTanggal(o.dibuatPada)}
                </td>
                <td className="px-4 py-3">{namaCabang(o.cabangId)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink/60">
                  {o.stokSistem}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {o.stokFisik}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 justify-end font-mono font-medium ${
                      cocok
                        ? "text-ink/40"
                        : o.selisih > 0
                          ? "text-moss"
                          : "text-rust"
                    }`}
                  >
                    {cocok ? (
                      <CheckCircle2 size={12} />
                    ) : o.selisih > 0 ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                    {cocok ? "Cocok" : `${o.selisih > 0 ? "+" : ""}${o.selisih}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                  {o.alasan ? (
                    <>
                      <span className="font-medium">{o.alasan}</span>
                      {o.catatan && (
                        <span className="text-ink/50"> — {o.catatan}</span>
                      )}
                    </>
                  ) : (
                    o.catatan || <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                  {o.dibuatOlehNama || <span className="text-ink/30">—</span>}
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                Belum ada riwayat stok opname untuk barang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
