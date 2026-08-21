"use client";

import { useState } from "react";
import { ArrowRightLeft, CheckCircle2, Clock } from "lucide-react";
import { TransferStok, Cabang } from "@/lib/types";

type Props = {
  data: TransferStok[];
  daftarCabang: Cabang[];
  onKonfirmasiTerima?: (transferId: string) => Promise<void>;
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

export default function TransferStokTable({
  data,
  daftarCabang,
  onKonfirmasiTerima,
}: Props) {
  const [memproses, setMemproses] = useState<string | null>(null);

  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  async function konfirmasi(id: string) {
    if (!onKonfirmasiTerima) return;
    if (!confirm("Konfirmasi barang sudah sampai di cabang tujuan?")) return;
    setMemproses(id);
    try {
      await onKonfirmasiTerima(id);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Gagal mengonfirmasi transfer.",
      );
    } finally {
      setMemproses(null);
    }
  }

  return (
    <div className="bg-white border border-ink/10 rounded-sm overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Dari</th>
            <th className="px-4 py-3 font-medium">Ke</th>
            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Dikirim oleh
            </th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Diterima oleh
            </th>
            <th className="px-4 py-3 font-medium">Catatan</th>
            {onKonfirmasiTerima && (
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((t) => {
            const terkirim = t.status === "terkirim";
            return (
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
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
                      terkirim
                        ? "bg-wheat/30 text-ink/70"
                        : "bg-moss/10 text-moss"
                    }`}
                  >
                    {terkirim ? (
                      <Clock size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    {terkirim ? "Terkirim" : "Diterima"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                  {t.dibuatOlehNama || <span className="text-ink/30">—</span>}
                </td>
                <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                  {t.diterimaOlehNama || (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {t.catatan || <span className="text-ink/30">—</span>}
                </td>
                {onKonfirmasiTerima && (
                  <td className="px-4 py-3 text-right">
                    {terkirim && (
                      <button
                        onClick={() => konfirmasi(t.id)}
                        disabled={memproses === t.id}
                        className="px-3 py-1.5 border border-ink/15 text-xs font-medium rounded-sm hover:bg-paper transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {memproses === t.id
                          ? "Memproses..."
                          : "Tandai Diterima"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={onKonfirmasiTerima ? 9 : 8}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                Belum ada transfer stok untuk barang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
