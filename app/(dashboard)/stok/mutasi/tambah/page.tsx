"use client";

// ============================================================
// Halaman: Riwayat Mutasi Stok
// Taruh di app/(dashboard)/stok/mutasi/page.tsx
// ============================================================

import Link from "next/link";
import { useMutasiStok } from "@/lib/useMutasiStok";
import MutasiTable from "@/components/MutasiTable";

export default function RiwayatMutasiPage() {
  const { data, loading, error } = useMutasiStok();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Riwayat Mutasi Stok</h1>
        <Link
          href="/stok/mutasi/tambah"
          className="rounded-md bg-black text-white px-4 py-2 text-sm"
        >
          + Tambah Mutasi
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <MutasiTable data={data} loading={loading} />
    </div>
  );
}
