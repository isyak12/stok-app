"use client";

// Komponen bersama untuk menampilkan grid thumbnail lampiran/foto
// bukti + lightbox-nya. Sebelumnya di-copy-paste identik di
// TransaksiStokTable.tsx dan StokOpnameTable.tsx -- dipindah ke sini
// supaya kalau nanti dipakai di tempat ketiga (mis. riwayat mutasi),
// tidak perlu dobel maintain.

// Grid thumbnail kecil untuk lampiran/foto bukti. Maksimal 4
// thumbnail ditampilkan sekaligus -- sisanya diringkas jadi "+N"
// yang tetap bisa diklik untuk buka lightbox mulai dari foto ke-5.
export function GridLampiran({
  urls,
  onKlikFoto,
  labelAlt = "Lampiran",
}: {
  urls: string[];
  onKlikFoto: (index: number) => void;
  labelAlt?: string;
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
            alt={`${labelAlt} ${i + 1}`}
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

// Lightbox sederhana: overlay gelap penuh layar dengan navigasi
// sebelumnya/berikutnya kalau lampirannya lebih dari satu.
export function Lightbox({
  urls,
  index,
  onIndexChange,
  onTutup,
  labelAlt = "Lampiran",
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onTutup: () => void;
  labelAlt?: string;
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
          alt={`${labelAlt} ${index + 1}`}
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
