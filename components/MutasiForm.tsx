"use client";

// ============================================================
// Komponen MutasiForm
// Taruh di components/MutasiForm.tsx
// Mengikuti pola StokForm.tsx yang sudah ada.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutasiStok } from "@/lib/useMutasiStok";
import type { Barang } from "@/lib/types";
import type { JenisMutasi } from "@/lib/types";

interface MutasiFormProps {
  daftarBarang: Barang[];
  produkIdAwal?: string;
}

export default function MutasiForm({ daftarBarang, produkIdAwal }: MutasiFormProps) {
  const router = useRouter();
  const { tambahMutasi } = useMutasiStok();

  const [produkId, setProdukId] = useState(produkIdAwal ?? "");
  const [jenis, setJenis] = useState<JenisMutasi>("masuk");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!produkId) {
      setError("Pilih barang terlebih dahulu.");
      return;
    }
    const jumlahAngka = parseInt(jumlah, 10);
    if (!jumlahAngka || jumlahAngka <= 0) {
      setError("Jumlah harus lebih dari 0.");
      return;
    }

    setMenyimpan(true);
    try {
      await tambahMutasi({
        produk_id: produkId,
        jenis,
        jumlah: jumlahAngka,
        keterangan,
      });
      router.push("/mutasi");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan mutasi.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Barang</label>
        <select
          className="w-full rounded-md border px-3 py-2"
          value={produkId}
          onChange={(e) => setProdukId(e.target.value)}
        >
          <option value="">-- Pilih barang --</option>
          {daftarBarang.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nama} ({b.sku}) — stok saat ini: {b.jumlah}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Jenis mutasi</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="jenis"
              value="masuk"
              checked={jenis === "masuk"}
              onChange={() => setJenis("masuk")}
            />
            Barang masuk
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="jenis"
              value="keluar"
              checked={jenis === "keluar"}
              onChange={() => setJenis("keluar")}
            />
            Barang keluar
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Jumlah</label>
        <input
          type="number"
          min={1}
          className="w-full rounded-md border px-3 py-2"
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Keterangan <span className="text-gray-400">(opsional)</span>
        </label>
        <textarea
          className="w-full rounded-md border px-3 py-2"
          rows={3}
          placeholder="Mis. Restock dari supplier, penjualan ke pelanggan, dsb."
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={menyimpan}
        className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {menyimpan ? "Menyimpan..." : "Simpan mutasi"}
      </button>
    </form>
  );
}
