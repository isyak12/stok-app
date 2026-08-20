"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarangInput, Barang } from "@/lib/types";
import { useCabang } from "@/lib/storage";

type Props = {
  awal?: Barang;
  onSimpan: (input: BarangInput) => Promise<void>;
  judul: string;
};

const KATEGORI_UMUM = [
  "Elektronik",
  "Alat Tulis",
  "Sembako",
  "Perawatan Rumah",
  "Pakaian",
  "Lainnya",
];

export default function StokForm({ awal, onSimpan, judul }: Props) {
  const router = useRouter();
  const { data: daftarCabang, siap: cabangSiap } = useCabang();
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BarangInput>({
    sku: awal?.sku ?? "",
    nama: awal?.nama ?? "",
    kategori: awal?.kategori ?? KATEGORI_UMUM[0],
    jumlah: awal?.jumlah ?? 0,
    satuan: awal?.satuan ?? "pcs",
    stokMinimum: awal?.stokMinimum ?? 0,
    hargaBeli: awal?.hargaBeli ?? 0,
    hargaJual: awal?.hargaJual ?? 0,
    lokasi: awal?.lokasi ?? "",
    cabangId: awal?.cabangId ?? "",
  });

  function ubah<K extends keyof BarangInput>(kunci: K, nilai: BarangInput[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim() || !form.sku.trim()) return;
    setError(null);
    setMenyimpan(true);
    try {
      await onSimpan(form);
      router.push("/stok");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan barang. Coba lagi.",
      );
      setMenyimpan(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl"
    >
      <h2 className="font-display text-lg font-semibold mb-6">{judul}</h2>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Kode SKU">
          <input
            required
            value={form.sku}
            onChange={(e) => ubah("sku", e.target.value)}
            placeholder="cth. ELK-0099"
            className="input font-mono"
          />
        </Field>

        <Field label="Kategori">
          <select
            value={form.kategori}
            onChange={(e) => ubah("kategori", e.target.value)}
            className="input"
          >
            {KATEGORI_UMUM.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>

        <Field label="Cabang">
          <select
            required
            value={form.cabangId}
            onChange={(e) => ubah("cabangId", e.target.value)}
            className="input"
          >
            <option value="" disabled>
              {cabangSiap ? "Pilih cabang" : "Memuat..."}
            </option>
            {daftarCabang.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nama Barang" span2>
          <input
            required
            value={form.nama}
            onChange={(e) => ubah("nama", e.target.value)}
            placeholder="cth. Kabel HDMI 2m"
            className="input"
          />
        </Field>

        <Field label="Jumlah Stok">
          <input
            type="number"
            min={0}
            value={form.jumlah}
            onChange={(e) => ubah("jumlah", Number(e.target.value))}
            className="input font-mono"
          />
        </Field>

        <Field label="Satuan">
          <input
            value={form.satuan}
            onChange={(e) => ubah("satuan", e.target.value)}
            placeholder="pcs / kg / box"
            className="input"
          />
        </Field>

        <Field label="Stok Minimum">
          <input
            type="number"
            min={0}
            value={form.stokMinimum}
            onChange={(e) => ubah("stokMinimum", Number(e.target.value))}
            className="input font-mono"
          />
        </Field>

        <Field label="Lokasi Penyimpanan">
          <input
            value={form.lokasi}
            onChange={(e) => ubah("lokasi", e.target.value)}
            placeholder="cth. Rak A1"
            className="input"
          />
        </Field>

        <Field label="Harga Beli (Rp)">
          <input
            type="number"
            min={0}
            value={form.hargaBeli}
            onChange={(e) => ubah("hargaBeli", Number(e.target.value))}
            className="input font-mono"
          />
        </Field>

        <Field label="Harga Jual (Rp)">
          <input
            type="number"
            min={0}
            value={form.hargaJual}
            onChange={(e) => ubah("hargaJual", Number(e.target.value))}
            className="input font-mono"
          />
        </Field>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          disabled={menyimpan}
          className="px-5 py-2.5 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {menyimpan ? "Menyimpan..." : "Simpan Barang"}
        </button>
        <button
          type="button"
          disabled={menyimpan}
          onClick={() => router.push("/stok")}
          className="px-5 py-2.5 border border-ink/15 text-sm rounded-sm hover:bg-paper transition-colors disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <label className={`block ${span2 ? "col-span-2" : ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
