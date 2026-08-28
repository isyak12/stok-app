"use client";

import { useState } from "react";
import Link from "next/link";
import { useCabang, useStok } from "@/lib/storage";
import { useUser } from "@/lib/useUser";
import StokTable from "@/components/StokTable";
import { PackagePlus, Building2 } from "lucide-react";
import { adalahAdminAtauLebih } from "@/lib/role";

export default function DaftarStokPage() {
  const { data, siap, error, hapus } = useStok();
  const { data: daftarCabang } = useCabang();
  const { peran } = useUser();

  // "semua" = tampilkan jumlah gabungan semua cabang (perilaku
  // lama). Selain itu, id cabang yang dipilih — tabel akan
  // menampilkan jumlah & lokasi khusus cabang itu, dan hanya barang
  // yang punya baris stok di cabang tersebut yang ditampilkan.
  const [cabangTerpilih, setCabangTerpilih] = useState<string>("semua");

  const jumlahBarangTerlihat =
    cabangTerpilih === "semua"
      ? data.length
      : data.filter((b) =>
          b.stokPerCabang.some((s) => s.cabangId === cabangTerpilih),
        ).length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
            Inventaris
          </div>
          <h1 className="font-display text-3xl font-semibold">
            Daftar Stok Barang
          </h1>
          <p className="text-ink/60 text-sm mt-1">
            {jumlahBarangTerlihat} jenis barang tercatat.
          </p>
        </div>
        {adalahAdminAtauLebih(peran) && (
          <Link
            href="/stok/tambah"
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-ink/90 transition-colors whitespace-nowrap"
          >
            <PackagePlus size={16} />
            Tambah Barang
          </Link>
        )}
      </header>

      {daftarCabang.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Building2 size={15} className="text-ink/40 shrink-0" />
          <button
            onClick={() => setCabangTerpilih("semua")}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              cabangTerpilih === "semua"
                ? "bg-ink text-paper border-ink"
                : "border-ink/15 text-ink/60 hover:bg-paper"
            }`}
          >
            Semua Cabang
          </button>
          {daftarCabang.map((c) => (
            <button
              key={c.id}
              onClick={() => setCabangTerpilih(c.id)}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                cabangTerpilih === c.id
                  ? "bg-ink text-paper border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-paper"
              }`}
            >
              {c.nama}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          Gagal memuat data dari Supabase: {error}
        </div>
      )}

      {!siap ? (
        <p className="text-ink/40 text-sm">Memuat data...</p>
      ) : (
        <StokTable
          data={data}
          onHapus={hapus}
          peran={peran}
          cabangId={cabangTerpilih === "semua" ? undefined : cabangTerpilih}
        />
      )}
    </div>
  );
}
