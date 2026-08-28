"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { AlasanOpname, Barang } from "@/lib/types";
import { useCabang } from "@/lib/storage";

const LABEL_ALASAN: Record<AlasanOpname, string> = {
  rusak: "Barang rusak",
  hilang: "Barang hilang",
  salah_catat: "Salah catat sebelumnya",
  lainnya: "Lainnya",
};

type Props = {
  barang: Barang;
  onCatat: (
    cabangId: string,
    stokFisik: number,
    alasan?: string,
    catatan?: string,
  ) => Promise<void>;
};

export default function StokOpnameForm({ barang, onCatat }: Props) {
  const {
    data: daftarCabang,
    siap: cabangSiap,
    error: errorCabang,
  } = useCabang();
  const [cabangId, setCabangId] = useState(barang.cabangId);
  const [stokFisik, setStokFisik] = useState<number | "">("");
  const [alasan, setAlasan] = useState<AlasanOpname | "">("");
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  useEffect(() => {
    setCabangId(barang.cabangId);
  }, [barang.cabangId]);

  const stokSistem = useMemo(
    () => barang.stokPerCabang.find((s) => s.cabangId === cabangId)?.jumlah,
    [barang.stokPerCabang, cabangId],
  );

  const selisih =
    stokFisik === "" || stokSistem === undefined
      ? null
      : stokFisik - stokSistem;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSukses(null);

    if (!cabangId) {
      setError("Pilih cabang terlebih dahulu.");
      return;
    }
    if (stokFisik === "" || stokFisik < 0) {
      setError("Isi hasil hitung fisik (angka 0 atau lebih).");
      return;
    }
    if (selisih !== null && selisih !== 0 && !alasan) {
      setError(
        "Ada selisih dengan stok sistem — pilih alasan penyesuaian dulu.",
      );
      return;
    }
    if (alasan === "lainnya" && !catatan.trim()) {
      setError('Alasan "Lainnya" perlu dijelaskan singkat di catatan.');
      return;
    }

    setError(null);
    setMenyimpan(true);
    try {
      const alasanLabel = alasan ? LABEL_ALASAN[alasan] : undefined;
      await onCatat(cabangId, stokFisik, alasanLabel, catatan);
      setSukses(
        selisih === 0 || selisih === null
          ? "Opname dicatat. Stok sistem sudah cocok dengan hitungan fisik."
          : `Opname dicatat. Stok dikoreksi ${selisih! > 0 ? "+" : ""}${selisih} (${alasanLabel}).`,
      );
      setStokFisik("");
      setAlasan("");
      setCatatan("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mencatat stok opname.",
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
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-ink/5 text-ink/70">
          <ClipboardCheck size={16} />
        </span>
        <h2 className="font-display text-lg font-semibold">
          Catat Hasil Hitung Fisik
        </h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          {error}
        </div>
      )}
      {sukses && (
        <div className="mb-4 px-4 py-3 bg-moss/10 border border-moss/30 text-moss text-sm rounded-sm">
          {sukses}
        </div>
      )}

      <label className="block mb-4">
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
        {errorCabang && (
          <span className="text-xs text-rust block mt-1.5">
            Gagal memuat daftar cabang: {errorCabang}
          </span>
        )}
      </label>

      <div className="mb-4 px-4 py-3 bg-paper/60 border border-ink/10 rounded-sm text-sm">
        <span className="text-ink/50">Stok sistem saat ini: </span>
        <span className="font-mono font-medium">
          {stokSistem ?? "—"} {barang.satuan}
        </span>
      </div>

      <label className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Hasil hitung fisik
        </span>
        <input
          type="number"
          min={0}
          required
          value={stokFisik}
          onChange={(e) =>
            setStokFisik(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="cth. 42"
          className="input font-mono"
        />
      </label>

      {selisih !== null && selisih !== 0 && (
        <div
          className={`mb-4 px-4 py-3 rounded-sm text-sm border ${
            selisih > 0
              ? "bg-moss/10 border-moss/30 text-moss"
              : "bg-rust/10 border-rust/30 text-rust"
          }`}
        >
          Selisih: <span className="font-mono font-medium">{selisih > 0 ? "+" : ""}{selisih} {barang.satuan}</span>
          {" "}— akan tercatat sebagai transaksi stok {selisih > 0 ? "masuk" : "keluar"} penyesuaian.
        </div>
      )}

      {selisih !== null && selisih !== 0 && (
        <label className="block mb-4">
          <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
            Alasan selisih
          </span>
          <select
            value={alasan}
            onChange={(e) => setAlasan(e.target.value as AlasanOpname | "")}
            className="input"
          >
            <option value="" disabled>
              Pilih alasan
            </option>
            {(Object.keys(LABEL_ALASAN) as AlasanOpname[]).map((a) => (
              <option key={a} value={a}>
                {LABEL_ALASAN[a]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block mb-5">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Catatan {selisih !== null && selisih !== 0 ? "" : "(opsional)"}
        </span>
        <input
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="cth. dus penyok kena air hujan"
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={menyimpan}
        className="w-full px-5 py-2.5 text-sm font-medium rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-ink text-paper hover:bg-ink/90"
      >
        {menyimpan ? "Menyimpan..." : "Catat Hasil Opname"}
      </button>
    </form>
  );
}
