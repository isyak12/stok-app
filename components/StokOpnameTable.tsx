"use client";

import { useState } from "react";
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

// Sama persis dengan GridLampiran di TransaksiStokTable -- kalau
// nanti dipakai di tempat ketiga, sebaiknya dipindah jadi satu
// komponen bersama di components/LampiranFoto.tsx.
function GridLampiran({
  urls,
  onKlikFoto,
}: {
  urls: string[];
  onKlikFoto: (index: number) => void;
}) {
  if (urls.length === 0) {
    return <span className="text-ink/30 text-xs">—</span>;
  }
  const MAKS_TAMPIL = 4;
  const tampil = urls.slice(0, MAKS_TAMPIL);
  const sisa = urls.length - MAKS_TAMPIL;

  return (
    <div className="flex gap-1">
      {tampil.map((url, i) => (
        <button
          key={url}
          type="button"
          onClick={() => onKlikFoto(i)}
          className="relative w-9 h-9 rounded-sm overflow-hidden border border-ink/15 hover:border-ink/40 transition-colors shrink-0"
          title={`Lihat foto ${i + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Foto bukti ${i + 1}`}
            className="w-full h-full object-cover"
          />
          {i === MAKS_TAMPIL - 1 && sisa > 0 && (
            <span className="absolute inset-0 bg-ink/70 flex items-center justify-center text-paper text-[11px] font-medium">
              +{sisa}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Lightbox({
  urls,
  index,
  onIndexChange,
  onTutup,
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onTutup: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-ink/80 flex items-center justify-center p-4 z-50"
      onClick={onTutup}
    >
      <div
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[index]}
          alt={`Foto bukti ${index + 1}`}
          className="max-w-full max-h-[85vh] rounded-sm"
        />
        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                onIndexChange((index - 1 + urls.length) % urls.length)
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-ink/70 text-paper flex items-center justify-center hover:bg-ink"
              aria-label="Foto sebelumnya"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onIndexChange((index + 1) % urls.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-ink/70 text-paper flex items-center justify-center hover:bg-ink"
              aria-label="Foto berikutnya"
            >
              ›
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-ink/70 text-paper text-[11px] font-mono">
              {index + 1} / {urls.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function StokOpnameTable({ data, daftarCabang }: Props) {
  const [lightbox, setLightbox] = useState<{
    opnameId: string;
    index: number;
  } | null>(null);

  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  const opnameLightbox = lightbox
    ? data.find((o) => o.id === lightbox.opnameId)
    : null;

  return (
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
            <th className="px-4 py-3 font-medium">Foto</th>
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
                <td className="px-4 py-3">
                  <GridLampiran
                    urls={o.lampiranUrls}
                    onKlikFoto={(index) =>
                      setLightbox({ opnameId: o.id, index })
                    }
                  />
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
                colSpan={8}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                Belum ada riwayat stok opname untuk barang ini.
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
        />
      )}
    </div>
  );
}
