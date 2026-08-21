"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { TipeTransaksi } from "@/lib/types";
import { useCabang } from "@/lib/storage";

type Props = {
  cabangDefaultId?: string;
  onCatat: (
    tipe: TipeTransaksi,
    jumlah: number,
    cabangId: string,
    catatan?: string,
    pihak?: string,
    noReferensi?: string,
  ) => Promise<void>;
};

export default function TransaksiStokForm({ cabangDefaultId, onCatat }: Props) {
  const { data: daftarCabang, siap: cabangSiap } = useCabang();
  const [cabangId, setCabangId] = useState(cabangDefaultId ?? "");

  useEffect(() => {
    if (cabangDefaultId) {
      setCabangId(cabangDefaultId);
    }
  }, [cabangDefaultId]);

  return (
    <div>
      <label className="block mb-4 max-w-xs">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Cabang
        </span>
        <select
          value={cabangId}
          onChange={(e) => setCabangId(e.target.value)}
          disabled={!cabangSiap}
          className="input"
        >
          <option value="" disabled>
            {cabangSiap ? "Pilih cabang" : "Memuat..."}
          </option>
          {daftarCabang.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nama} ({c.kode})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KartuTransaksi tipe="masuk" cabangId={cabangId} onCatat={onCatat} />
        <KartuTransaksi tipe="keluar" cabangId={cabangId} onCatat={onCatat} />
      </div>
    </div>
  );
}

function KartuTransaksi({
  tipe,
  cabangId,
  onCatat,
}: {
  tipe: TipeTransaksi;
  cabangId: string;
  onCatat: Props["onCatat"];
}) {
  const [jumlah, setJumlah] = useState<number | "">("");
  const [catatan, setCatatan] = useState("");
  const [pihak, setPihak] = useState("");
  const [noReferensi, setNoReferensi] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const masuk = tipe === "masuk";
  const warna = masuk ? "moss" : "rust";
  const Icon = masuk ? ArrowDownToLine : ArrowUpFromLine;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!jumlah || jumlah <= 0) {
      setError("Jumlah harus lebih besar dari 0.");
      return;
    }
    if (!cabangId) {
      setError("Pilih cabang terlebih dahulu.");
      return;
    }
    setError(null);
    setMenyimpan(true);
    try {
      await onCatat(tipe, jumlah, cabangId, catatan, pihak, noReferensi);
      setJumlah("");
      setCatatan("");
      setPihak("");
      setNoReferensi("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Gagal mencatat stok ${masuk ? "masuk" : "keluar"}. Coba lagi.`,
      );
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-ink/10 rounded-sm p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-sm ${
            masuk ? "bg-moss/10 text-moss" : "bg-rust/10 text-rust"
          }`}
        >
          <Icon size={16} />
        </span>
        <h2 className="font-display text-lg font-semibold">
          Stok {masuk ? "Masuk" : "Keluar"}
        </h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          {error}
        </div>
      )}

      <label className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Jumlah
        </span>
        <input
          type="number"
          min={1}
          required
          value={jumlah}
          onChange={(e) =>
            setJumlah(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="cth. 10"
          className="input font-mono"
        />
      </label>

      <label className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          {masuk ? "Nama Supplier" : "Nama Pembeli"} (opsional)
        </span>
        <input
          value={pihak}
          onChange={(e) => setPihak(e.target.value)}
          placeholder={masuk ? "cth. CV Sumber Makmur" : "cth. Toko Berkah"}
          className="input"
        />
      </label>

      <label className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          No. Referensi (opsional)
        </span>
        <input
          value={noReferensi}
          onChange={(e) => setNoReferensi(e.target.value)}
          placeholder="cth. No. Nota / Invoice / PO"
          className="input font-mono"
        />
      </label>

      <label className="block mb-5">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Catatan (opsional)
        </span>
        <input
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder={masuk ? "cth. Pembelian dari supplier" : "cth. Penjualan ke pelanggan"}
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={menyimpan}
        className={`w-full px-5 py-2.5 text-sm font-medium rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          masuk
            ? "bg-moss text-paper hover:bg-moss/90"
            : "bg-rust text-paper hover:bg-rust/90"
        }`}
      >
        {menyimpan
          ? "Menyimpan..."
          : `Catat Stok ${masuk ? "Masuk" : "Keluar"}`}
      </button>
    </form>
  );
}
