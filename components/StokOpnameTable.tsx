"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Search, TrendingDown, TrendingUp } from "lucide-react";
import { Cabang, StokOpname } from "@/lib/types";
import { GridLampiran, Lightbox } from "@/components/LampiranFoto";

type Props = {
  data: StokOpname[];
  daftarCabang: Cabang[];
};

type FilterSelisih = "semua" | "cocok" | "lebih" | "kurang";

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
  const [lightbox, setLightbox] = useState<{
    opnameId: string;
    index: number;
  } | null>(null);

  // Pencarian & filter riwayat opname.
  const [q, setQ] = useState("");
  const [selisihFilter, setSelisihFilter] = useState<FilterSelisih>("semua");
  const [cabangFilter, setCabangFilter] = useState("semua");

  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  const hasil = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return data.filter((o) => {
      const cocokTeks =
        qLower === "" ||
        (o.alasan ?? "").toLowerCase().includes(qLower) ||
        (o.catatan ?? "").toLowerCase().includes(qLower) ||
        (o.dibuatOlehNama ?? "").toLowerCase().includes(qLower) ||
        namaCabang(o.cabangId).toLowerCase().includes(qLower);
      const cocokSelisih =
        selisihFilter === "semua" ||
        (selisihFilter === "cocok" && o.selisih === 0) ||
        (selisihFilter === "lebih" && o.selisih > 0) ||
        (selisihFilter === "kurang" && o.selisih < 0);
      const cocokCabang =
        cabangFilter === "semua" || o.cabangId === cabangFilter;
      return cocokTeks && cocokSelisih && cocokCabang;
    });
  }, [data, q, selisihFilter, cabangFilter, daftarCabang]);

  const opnameLightbox = lightbox
    ? data.find((o) => o.id === lightbox.opnameId)
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
              placeholder="Cari alasan, catatan, dicatat oleh, atau cabang..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-ink/15 rounded-sm text-base sm:text-sm focus:outline-none focus:border-rust"
            />
          </div>
          <select
            value={selisihFilter}
            onChange={(e) => setSelisihFilter(e.target.value as FilterSelisih)}
            className="px-3 py-2.5 bg-white border border-ink/15 rounded-sm text-base sm:text-sm focus:outline-none focus:border-rust"
          >
            <option value="semua">Semua Selisih</option>
            <option value="cocok">Cocok</option>
            <option value="lebih">Lebih</option>
            <option value="kurang">Kurang</option>
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
      <table className="w-full min-w-[820px] text-sm">
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
            {/* Ditaruh setelah Alasan/Catatan (bukan sebelum) supaya
                urutan bacanya natural: lihat selisih -> baca
                alasannya -> cek fotonya sebagai bukti. */}
            <th className="px-4 py-3 font-medium">Foto</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Dicatat oleh
            </th>
          </tr>
        </thead>
        <tbody>
          {hasil.map((o) => {
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
                <td className="px-4 py-3">
                  <GridLampiran
                    urls={o.lampiranUrls}
                    onKlikFoto={(index) =>
                      setLightbox({ opnameId: o.id, index })
                    }
                    labelAlt="Foto bukti"
                  />
                </td>
                <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                  {o.dibuatOlehNama || <span className="text-ink/30">—</span>}
                </td>
              </tr>
            );
          })}
          {hasil.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                {data.length === 0
                  ? "Belum ada riwayat stok opname untuk barang ini."
                  : "Tidak ada catatan opname yang cocok. Coba kata kunci atau filter lain."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {lightbox && opnameLightbox && (
        <Lightbox
          urls={opnameLightbox.lampiranUrls}
          index={lightbox.index}
          onIndexChange={(i) =>
            setLightbox({ opnameId: lightbox.opnameId, index: i })
          }
          onTutup={() => setLightbox(null)}
          labelAlt="Foto bukti"
        />
      )}
      </div>
    </div>
  );
}
