"use client";

import Link from "next/link";
import { useStok } from "@/lib/storage";
import StokTable from "@/components/StokTable";
import { PackagePlus } from "lucide-react";

export default function DaftarStokPage() {
  const { data, siap, error, hapus } = useStok();

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
            Inventaris
          </div>
          <h1 className="font-display text-3xl font-semibold">
            Daftar Stok Barang
          </h1>
          <p className="text-ink/60 text-sm mt-1">
            {data.length} jenis barang tercatat.
          </p>
        </div>
        <Link
          href="/stok/tambah"
          className="flex items-center gap-2 px-4 py-2.5 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-ink/90 transition-colors whitespace-nowrap"
        >
          <PackagePlus size={16} />
          Tambah Barang
        </Link>
      </header>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          Gagal memuat data dari Supabase: {error}
        </div>
      )}

      {!siap ? (
        <p className="text-ink/40 text-sm">Memuat data...</p>
      ) : (
        <StokTable data={data} onHapus={hapus} />
      )}
    </div>
  );
}
