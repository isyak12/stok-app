"use client";

// ============================================================
// Komponen MutasiTable
// Taruh di components/MutasiTable.tsx
// Mengikuti pola StokTable.tsx yang sudah ada.
// ============================================================

import type { MutasiStokDenganProduk } from "@/lib/types";

interface MutasiTableProps {
  data: MutasiStokDenganProduk[];
  loading?: boolean;
}

export default function MutasiTable({ data, loading }: MutasiTableProps) {
  if (loading) {
    return <p className="text-sm text-gray-500">Memuat riwayat mutasi...</p>;
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Belum ada riwayat mutasi stok. Catat mutasi lewat tombol &quot;Tambah Mutasi&quot;.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2">Tanggal</th>
            <th className="text-left px-3 py-2">Barang</th>
            <th className="text-left px-3 py-2">Jenis</th>
            <th className="text-right px-3 py-2">Jumlah</th>
            <th className="text-left px-3 py-2">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(m.created_at).toLocaleString("id-ID")}
              </td>
              <td className="px-3 py-2">
                {m.produk?.nama}{" "}
                <span className="text-gray-400">({m.produk?.sku})</span>
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    m.jenis === "masuk"
                      ? "inline-block rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs"
                      : "inline-block rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs"
                  }
                >
                  {m.jenis === "masuk" ? "Masuk" : "Keluar"}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                {m.jenis === "masuk" ? "+" : "-"}
                {m.jumlah} {m.produk?.satuan}
              </td>
              <td className="px-3 py-2 text-gray-600">{m.keterangan || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
