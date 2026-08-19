"use client";

import { useStok } from "@/lib/storage";
import StokForm from "@/components/StokForm";

export default function TambahStokPage() {
  const { tambah } = useStok();

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Inventaris
        </div>
        <h1 className="font-display text-3xl font-semibold">
          Tambah Barang Baru
        </h1>
      </div>
      <StokForm judul="Detail Barang" onSimpan={tambah} />
    </div>
  );
}
