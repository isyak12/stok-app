"use client";

import { useState } from "react";
import { useMutasiStok } from "@/lib/useMutasiStok";
import type { JenisMutasi } from "@/lib/types-mutasi";

const MAX_FILE_MB = 5;
const TIPE_DIIZINKAN = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

interface Props {
  produkId: string;
  namaProduk: string;
  onSukses?: () => void;
}

export default function MutasiStokForm({ produkId, namaProduk, onSukses }: Props) {
  const { buatMutasi, loading, error } = useMutasiStok();

  const [jenis, setJenis] = useState<JenisMutasi>("masuk");
  const [jumlah, setJumlah] = useState<number>(1);
  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const dipilih = Array.from(e.target.files ?? []);

    const invalid = dipilih.find(
      (f) => !TIPE_DIIZINKAN.includes(f.type) || f.size > MAX_FILE_MB * 1024 * 1024
    );
    if (invalid) {
      setFileError(
        `File "${invalid.name}" tidak valid. Gunakan JPG/PNG/WEBP/PDF, maks ${MAX_FILE_MB}MB.`
      );
      return;
    }
    setFiles(dipilih);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasil = await buatMutasi({
      produk_id: produkId,
      jenis,
      jumlah,
      keterangan,
      tanggal,
      files,
    });
    if (hasil) {
      setJumlah(1);
      setKeterangan("");
      setFiles([]);
      onSukses?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="text-sm text-gray-500">Barang</p>
        <p className="font-medium">{namaProduk}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setJenis("masuk")}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            jenis === "masuk" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Barang Masuk / Pembelian
        </button>
        <button
          type="button"
          onClick={() => setJenis("keluar")}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            jenis === "keluar" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Barang Keluar / Pemasangan
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-600">Jumlah</label>
          <input
            type="number"
            min={1}
            required
            value={jumlah}
            onChange={(e) => setJumlah(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Tanggal</label>
          <input
            type="date"
            required
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-600">
          Keterangan {jenis === "masuk" ? "(mis. nama supplier / no. nota)" : "(mis. lokasi/proyek pemasangan)"}
        </label>
        <input
          type="text"
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm text-gray-600">
          Lampiran {jenis === "masuk" ? "(foto nota/faktur pembelian)" : "(foto bukti pemasangan)"}
        </label>
        <input
          type="file"
          multiple
          accept={TIPE_DIIZINKAN.join(",")}
          onChange={handleFileChange}
          className="mt-1 w-full text-sm"
        />
        {files.length > 0 && (
          <ul className="mt-1 text-xs text-gray-500">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
        {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Menyimpan..." : "Simpan Mutasi"}
      </button>
    </form>
  );
}
