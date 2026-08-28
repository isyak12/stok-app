"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ArrowRightLeft } from "lucide-react";
import { useCabang, useTransferMenunggu } from "@/lib/storage";

// Format waktu relatif singkat ("5 menit lalu", "3 jam lalu", dst).
// Di atas 7 hari, tampilkan tanggal biasa supaya tetap jelas tanpa
// jadi "123 hari lalu" yang kurang bermakna.
function waktuRelatif(iso: string) {
  const detik = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return "Baru saja";
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

export default function NotifikasiTransferMasuk() {
  const { data, siap } = useTransferMenunggu();
  const { data: daftarCabang } = useCabang();
  const [terbuka, setTerbuka] = useState(false);
  const wadahRef = useRef<HTMLDivElement>(null);

  const jumlah = data.length;

  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  useEffect(() => {
    function tutupKalauKlikLuar(e: MouseEvent) {
      if (wadahRef.current && !wadahRef.current.contains(e.target as Node)) {
        setTerbuka(false);
      }
    }
    document.addEventListener("mousedown", tutupKalauKlikLuar);
    return () => document.removeEventListener("mousedown", tutupKalauKlikLuar);
  }, []);

  return (
    <div className="relative" ref={wadahRef}>
      <button
        type="button"
        onClick={() => setTerbuka((v) => !v)}
        className="relative p-2 rounded-sm text-wheat/70 hover:text-paper hover:bg-white/5 transition-colors"
        aria-label={
          jumlah > 0
            ? `${jumlah} transfer menunggu konfirmasi`
            : "Tidak ada transfer menunggu konfirmasi"
        }
      >
        <Bell size={19} strokeWidth={1.75} />
        {jumlah > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rust text-[10px] font-semibold text-paper leading-none">
            {jumlah > 9 ? "9+" : jumlah}
          </span>
        )}
      </button>

      {terbuka && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto bg-white border border-ink/10 rounded-sm shadow-lg z-50 text-ink">
          <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between">
            <p className="text-sm font-medium">Transfer Menunggu Konfirmasi</p>
            {jumlah > 0 && (
              <span className="text-[11px] text-ink/40 font-mono">
                {jumlah}
              </span>
            )}
          </div>

          {!siap ? (
            <p className="px-4 py-6 text-center text-ink/40 text-sm">
              Memuat...
            </p>
          ) : jumlah === 0 ? (
            <p className="px-4 py-6 text-center text-ink/40 text-sm">
              Tidak ada transfer yang menunggu konfirmasi.
            </p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {data.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/stok/${t.produkId}/transfer`}
                    onClick={() => setTerbuka(false)}
                    className="block px-4 py-3 hover:bg-paper/60 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">
                      {t.produkNama}
                    </p>
                    <p className="text-xs text-ink/60 mt-0.5 flex items-center gap-1">
                      {namaCabang(t.dariCabangId)}
                      <ArrowRightLeft size={11} className="text-ink/30 shrink-0" />
                      {namaCabang(t.keCabangId)}
                      <span className="text-ink/40">
                        · {t.jumlah} unit
                      </span>
                    </p>
                    <p className="text-[11px] text-ink/40 mt-0.5">
                      {waktuRelatif(t.dibuatPada)}
                      {t.dibuatOlehNama ? ` · dikirim oleh ${t.dibuatOlehNama}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
