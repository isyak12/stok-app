"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Barang } from "@/lib/types";
import { Search, Pencil, Trash2, TriangleAlert } from "lucide-react";

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  data: Barang[];
  onHapus: (id: string) => Promise<void>;
};

export default function StokTable({ data, onHapus }: Props) {
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("Semua");

  const kategoriList = useMemo(
    () => ["Semua", ...Array.from(new Set(data.map((b) => b.kategori)))],
    [data]
  );

  const hasil = useMemo(() => {
    return data.filter((b) => {
      const cocokTeks =
        b.nama.toLowerCase().includes(q.toLowerCase()) ||
        b.sku.toLowerCase().includes(q.toLowerCase());
      const cocokKategori = kategori === "Semua" || b.kategori === kategori;
      return cocokTeks && cocokKategori;
    });
  }, [data, q, kategori]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau SKU barang..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-ink/15 rounded-sm text-sm focus:outline-none focus:border-rust"
          />
        </div>
        <select
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          className="px-3 py-2.5 bg-white border border-ink/15 rounded-sm text-sm focus:outline-none focus:border-rust"
        >
          {kategoriList.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Nama Barang</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium text-right">Jumlah</th>
              <th className="px-4 py-3 font-medium text-right">Harga Jual</th>
              <th className="px-4 py-3 font-medium">Lokasi</th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {hasil.map((b) => {
              const rendah = b.stokRendah;
              return (
                <tr
                  key={b.id}
                  className="border-b border-ink/5 last:border-0 hover:bg-paper/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-ink/70">
                    {b.sku}
                  </td>
                  <td className="px-4 py-3 font-medium">{b.nama}</td>
                  <td className="px-4 py-3 text-ink/70">{b.kategori}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span
                      className={
                        rendah
                          ? "inline-flex items-center gap-1 text-rust font-semibold"
                          : ""
                      }
                    >
                      {rendah && <TriangleAlert size={13} />}
                      {b.jumlah} {b.satuan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatRupiah(b.hargaJual)}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{b.lokasi}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/stok/${b.id}`}
                        className="p-1.5 rounded-sm hover:bg-ink/5 text-ink/60 hover:text-ink"
                        title="Ubah"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={async () => {
                          if (confirm(`Hapus "${b.nama}" dari stok?`)) {
                            try {
                              await onHapus(b.id);
                            } catch (err) {
                              alert(
                                err instanceof Error
                                  ? err.message
                                  : "Gagal menghapus barang."
                              );
                            }
                          }
                        }}
                        className="p-1.5 rounded-sm hover:bg-rust/10 text-ink/60 hover:text-rust"
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {hasil.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-ink/40 text-sm"
                >
                  Tidak ada barang yang cocok. Coba kata kunci lain.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
