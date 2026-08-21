"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Cabang, TransaksiStok } from "@/lib/types";

type Props = {
  data: TransaksiStok[];
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

export default function TransaksiStokTable({ data, daftarCabang }: Props) {
  const namaCabang = (cabangId: string) =>
    daftarCabang.find((c) => c.id === cabangId)?.nama ?? "—";

  return (
    <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Tipe</th>
            <th className="px-4 py-3 font-medium">Cabang</th>
            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
            <th className="px-4 py-3 font-medium">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t) => {
            const masuk = t.tipe === "masuk";
            return (
              <tr
                key={t.id}
                className="border-b border-ink/5 last:border-0 hover:bg-paper/50"
              >
                <td className="px-4 py-3 text-ink/70 font-mono text-xs whitespace-nowrap">
                  {formatTanggal(t.dibuatPada)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
                      masuk
                        ? "bg-moss/10 text-moss"
                        : "bg-rust/10 text-rust"
                    }`}
                  >
                    {masuk ? (
                      <ArrowDownToLine size={12} />
                    ) : (
                      <ArrowUpFromLine size={12} />
                    )}
                    {masuk ? "Masuk" : "Keluar"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {namaCabang(t.cabangId)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {masuk ? "+" : "-"}
                  {t.jumlah}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {t.catatan || <span className="text-ink/30">—</span>}
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                Belum ada transaksi stok untuk barang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
