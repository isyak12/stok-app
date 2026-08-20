"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useCabang } from "@/lib/storage";

type Props = {
  cabangDefaultId?: string;
  onCatat: (
    dariCabangId: string,
    keCabangId: string,
    jumlah: number,
    catatan?: string,
  ) => Promise<void>;
};

export default function TransferStokForm({ cabangDefaultId, onCatat }: Props) {
  const { data: daftarCabang, siap: cabangSiap } = useCabang();
  const [dariCabangId, setDariCabangId] = useState(cabangDefaultId ?? "");
  const [keCabangId, setKeCabangId] = useState("");
  const [jumlah, setJumlah] = useState<number | "">("");
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cabangTujuanList = daftarCabang.filter((c) => c.id !== dariCabangId);

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
    setError(null);
    setMenyimpan(true);
    try {
      await onCatat(dariCabangId, keCabangId, jumlah, catatan);
      setJumlah("");
      setCatatan("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mencatat transfer stok. Coba lagi.",
      );
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
        disabled={menyimpan}
        className="px-5 py-2.5 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {menyimpan ? "Memproses..." : "Transfer Stok"}
      </button>
    </form>
  );
}
