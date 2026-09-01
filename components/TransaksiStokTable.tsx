"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Search, XCircle } from "lucide-react";
import { Cabang, TransaksiStok } from "@/lib/types";
import { pesanError } from "@/lib/error";
import { GridLampiran, Lightbox } from "@/components/LampiranFoto";

type Props = {
  data: TransaksiStok[];
  daftarCabang: Cabang[];
  onBatalkan?: (transaksiId: string, alasan?: string) => Promise<void>;
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

export default function TransaksiStokTable({
  data,
  daftarCabang,
  onBatalkan,
}: Props) {
  const [memproses, setMemproses] = useState<string | null>(null);
  // Lampiran yang sedang dibuka di lightbox: transaksi id + index
  // foto yang lagi ditampilkan. null = lightbox tertutup.
  const [lightbox, setLightbox] = useState<{
    transaksiId: string;
    index: number;
  } | null>(null);

  // Pencarian & filter riwayat transaksi. Dipisah dari `data` mentah
  // supaya prop tetap sumber data asli (dipakai lightbox dkk lewat
  // id), sementara `hasil` di bawah cuma untuk apa yang ditampilkan
  // di tabel.
  const [q, setQ] = useState("");
  const [tipeFilter, setTipeFilter] = useState<"semua" | "masuk" | "keluar">(
    "semua",
  );
  const [cabangFilter, setCabangFilter] = useState("semua");

  const namaCabang = (cabangId: string) =>
    daftarCabang.find((c) => c.id === cabangId)?.nama ?? "—";

  const hasil = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return data.filter((t) => {
      const cocokTeks =
        qLower === "" ||
        (t.pihak ?? "").toLowerCase().includes(qLower) ||
        (t.noReferensi ?? "").toLowerCase().includes(qLower) ||
        (t.catatan ?? "").toLowerCase().includes(qLower) ||
        namaCabang(t.cabangId).toLowerCase().includes(qLower);
      const cocokTipe = tipeFilter === "semua" || t.tipe === tipeFilter;
      const cocokCabang =
        cabangFilter === "semua" || t.cabangId === cabangFilter;
      return cocokTeks && cocokTipe && cocokCabang;
    });
  }, [data, q, tipeFilter, cabangFilter, daftarCabang]);

  async function batalkan(id: string) {
    if (!onBatalkan) return;

    if (
      !confirm("Batalkan transaksi ini? Efeknya ke stok akan dikoreksi balik.")
    ) {
      return;
    }

    const alasan = prompt(
      "Alasan pembatalan (opsional, boleh dikosongkan):",
      "",
    );
    // null berarti user klik "Cancel" pada dialog alasan (batal
    // membatalkan), beda dari string kosong "" (sengaja tanpa alasan).
    if (alasan === null) return;

    setMemproses(id);
    try {
      await onBatalkan(id, alasan);
    } catch (err) {
      alert(pesanError(err, "Gagal membatalkan transaksi."));
    } finally {
      setMemproses(null);
    }
  }

  const transaksiLightbox = lightbox
    ? data.find((t) => t.id === lightbox.transaksiId)
    : null;

  return (
    <div>
      {data.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari pihak, no. referensi, catatan, atau cabang..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-ink/15 rounded-sm text-base sm:text-sm focus:outline-none focus:border-rust"
            />
          </div>
          <select
            value={tipeFilter}
            onChange={(e) =>
              setTipeFilter(e.target.value as "semua" | "masuk" | "keluar")
            }
            className="px-3 py-2.5 bg-white border border-ink/15 rounded-sm text-base sm:text-sm focus:outline-none focus:border-rust"
          >
            <option value="semua">Semua Tipe</option>
            <option value="masuk">Masuk</option>
            <option value="keluar">Keluar</option>
          </select>
          {daftarCabang.length > 1 && (
            <select
              value={cabangFilter}
              onChange={(e) => setCabangFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-ink/15 rounded-sm text-base sm:text-sm focus:outline-none focus:border-rust"
            >
              <option value="semua">Semua Cabang</option>
              {daftarCabang.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="bg-white border border-ink/10 rounded-sm overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Tipe</th>
            <th className="px-4 py-3 font-medium">Cabang</th>
            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Pihak
            </th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              No. Referensi
            </th>
            <th className="px-4 py-3 font-medium">Lampiran</th>
            <th className="px-4 py-3 font-medium">Catatan</th>
            {onBatalkan && (
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {hasil.map((t) => {
            const masuk = t.tipe === "masuk";
            return (
              <tr
                key={t.id}
                className={`border-b border-ink/5 last:border-0 hover:bg-paper/50 ${
                  t.dibatalkan ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3 text-ink/70 font-mono text-xs whitespace-nowrap">
                  {formatTanggal(t.dibuatPada)}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
                        masuk ? "bg-moss/10 text-moss" : "bg-rust/10 text-rust"
                      } ${t.dibatalkan ? "line-through decoration-2" : ""}`}
                    >
                      {masuk ? (
                        <ArrowDownToLine size={12} />
                      ) : (
                        <ArrowUpFromLine size={12} />
                      )}
                      {masuk ? "Masuk" : "Keluar"}
                    </span>
                    {t.dibatalkan && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-ink/5 text-ink/60">
                        <XCircle size={11} />
                        Dibatalkan
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-ink/70">
                  {namaCabang(t.cabangId)}
                </td>

                <td
                  className={`px-4 py-3 text-right font-mono ${
                    t.dibatalkan ? "line-through decoration-2" : ""
                  }`}
                >
                  {masuk ? "+" : "-"}
                  {t.jumlah}
                </td>

                <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                  {t.pihak || <span className="text-ink/30">—</span>}
                </td>

                <td className="px-4 py-3 text-ink/70 font-mono text-xs hidden md:table-cell">
                  {t.noReferensi || <span className="text-ink/30">—</span>}
                </td>

                <td className="px-4 py-3">
                  <GridLampiran
                    urls={t.lampiranUrls}
                    onKlikFoto={(index) =>
                      setLightbox({ transaksiId: t.id, index })
                    }
                    labelAlt="Lampiran"
                  />
                </td>

                <td className="px-4 py-3 text-ink/70">
                  {t.dibatalkan ? (
                    <span className="text-ink/50">
                      {t.alasanPembatalan
                        ? `Dibatalkan: ${t.alasanPembatalan}`
                        : "Dibatalkan"}
                      {t.dibatalkanOlehNama
                        ? ` — oleh ${t.dibatalkanOlehNama}`
                        : ""}
                    </span>
                  ) : (
                    t.catatan || <span className="text-ink/30">—</span>
                  )}
                </td>

                {onBatalkan && (
                  <td className="px-4 py-3 text-right">
                    {!t.dibatalkan && (
                      <button
                        onClick={() => batalkan(t.id)}
                        disabled={memproses === t.id}
                        className="px-3 py-1.5 border border-rust/30 text-rust text-xs font-medium rounded-sm hover:bg-rust/10 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {memproses === t.id ? "Memproses..." : "Batalkan"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}

          {hasil.length === 0 && (
            <tr>
              <td
                colSpan={onBatalkan ? 9 : 8}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                {data.length === 0
                  ? "Belum ada transaksi stok untuk barang ini."
                  : "Tidak ada transaksi yang cocok. Coba kata kunci atau filter lain."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {lightbox && transaksiLightbox && (
        <Lightbox
          urls={transaksiLightbox.lampiranUrls}
          index={lightbox.index}
          onIndexChange={(i) =>
            setLightbox({ transaksiId: lightbox.transaksiId, index: i })
          }
          onTutup={() => setLightbox(null)}
          labelAlt="Lampiran"
        />
      )}
      </div>
    </div>
  );
}
