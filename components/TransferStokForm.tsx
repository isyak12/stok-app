"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useCabang } from "@/lib/storage";
import { pesanError } from "@/lib/error";

type Props = {
  cabangDefaultId?: string;
  onCatat: (
    dariCabangId: string,
    keCabangId: string,
    jumlah: number,
    fotoBuktiKirim: File,
    catatan?: string,
  ) => Promise<void>;
};

// Batas ukuran file foto bukti, dijaga di sisi client supaya user
// dapat pesan error yang jelas sebelum upload dicoba (bucket Supabase
// Storage sendiri tidak dibatasi ukurannya lewat migrasi ini). Sama
// dengan batas foto bukti penerimaan di TransferStokTable.
const MAKS_UKURAN_FOTO_MB = 5;

export default function TransferStokForm({ cabangDefaultId, onCatat }: Props) {
  const {
    data: daftarCabang,
    siap: cabangSiap,
    error: errorCabang,
  } = useCabang();
  const [dariCabangId, setDariCabangId] = useState(cabangDefaultId ?? "");
  const [keCabangId, setKeCabangId] = useState("");
  const [jumlah, setJumlah] = useState<number | "">("");
  const [catatan, setCatatan] = useState("");
  const [fotoBukti, setFotoBukti] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cabangTujuanList = daftarCabang.filter((c) => c.id !== dariCabangId);

  // Bersihkan object URL preview saat komponen unmount, supaya tidak
  // bocor memori kalau user pindah halaman dengan preview masih ada.
  const previewFotoRef = useRef(previewFoto);
  previewFotoRef.current = previewFoto;
  useEffect(() => {
    return () => {
      if (previewFotoRef.current) URL.revokeObjectURL(previewFotoRef.current);
    };
  }, []);

  function pilihFoto(file: File | null) {
    if (previewFoto) URL.revokeObjectURL(previewFoto);
    if (!file) {
      setFotoBukti(null);
      setPreviewFoto(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, dsb).");
      setFotoBukti(null);
      setPreviewFoto(null);
      return;
    }
    if (file.size > MAKS_UKURAN_FOTO_MB * 1024 * 1024) {
      setError(`Ukuran foto maksimal ${MAKS_UKURAN_FOTO_MB}MB.`);
      setFotoBukti(null);
      setPreviewFoto(null);
      return;
    }
    setError(null);
    setFotoBukti(file);
    setPreviewFoto(URL.createObjectURL(file));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dariCabangId || !keCabangId) {
      setError("Pilih cabang asal dan cabang tujuan.");
      return;
    }
    if (dariCabangId === keCabangId) {
      setError("Cabang asal dan cabang tujuan tidak boleh sama.");
      return;
    }
    if (!jumlah || jumlah <= 0) {
      setError("Jumlah harus lebih besar dari 0.");
      return;
    }
    if (!fotoBukti) {
      setError("Foto bukti sebelum kirim wajib diunggah.");
      return;
    }
    setError(null);
    setMenyimpan(true);
    try {
      await onCatat(dariCabangId, keCabangId, jumlah, fotoBukti, catatan);
      setJumlah("");
      setCatatan("");
      pilihFoto(null);
    } catch (err) {
      setError(pesanError(err, "Gagal mencatat transfer stok. Coba lagi."));
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl"
    >
      <div className="flex items-center gap-2 mb-5">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-ink/5 text-ink">
          <ArrowRightLeft size={16} />
        </span>
        <h2 className="font-display text-lg font-semibold">Transfer Stok Antar Cabang</h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
            Dari Cabang
          </span>
          <select
            value={dariCabangId}
            onChange={(e) => {
              setDariCabangId(e.target.value);
              if (e.target.value === keCabangId) setKeCabangId("");
            }}
            disabled={!cabangSiap}
            className="input"
          >
            <option value="" disabled>
              {cabangSiap ? "Pilih cabang asal" : "Memuat..."}
            </option>
            {daftarCabang.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama} ({c.kode})
              </option>
            ))}
          </select>
          {errorCabang && (
            <span className="text-xs text-rust block mt-1.5">
              Gagal memuat daftar cabang: {errorCabang}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
            Ke Cabang
          </span>
          <select
            value={keCabangId}
            onChange={(e) => setKeCabangId(e.target.value)}
            disabled={!cabangSiap || !dariCabangId}
            className="input"
          >
            <option value="" disabled>
              {!dariCabangId ? "Pilih cabang asal dulu" : "Pilih cabang tujuan"}
            </option>
            {cabangTujuanList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama} ({c.kode})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Jumlah
        </span>
        <input
          type="number"
          min={1}
          required
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="cth. 10"
          className="input font-mono max-w-xs"
        />
      </label>

      <div className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Foto Bukti Sebelum Kirim
        </span>
        <p className="text-xs text-ink/50 mb-2">
          Foto kondisi/jumlah barang sebelum dikirim dari cabang asal. Wajib
          diisi.
        </p>
        <div className="flex items-start gap-3">
          <label className="px-3 py-1.5 border border-ink/15 text-xs font-medium rounded-sm hover:bg-paper cursor-pointer whitespace-nowrap">
            Pilih Foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pilihFoto(e.target.files?.[0] ?? null)}
            />
          </label>
          {previewFoto && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewFoto}
              alt="Pratinjau bukti sebelum kirim"
              className="w-16 h-16 object-cover rounded-sm border border-ink/15"
            />
          )}
        </div>
      </div>

      <label className="block mb-5">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Catatan (opsional)
        </span>
        <input
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="cth. Permintaan stok dari cabang tujuan"
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={menyimpan || !fotoBukti}
        className="px-5 py-2.5 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {menyimpan ? "Memproses..." : "Transfer Stok"}
      </button>
    </form>
  );
}
