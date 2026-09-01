"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, X } from "lucide-react";
import { TipeTransaksi } from "@/lib/types";
import { useCabang, useStokPerCabang } from "@/lib/storage";
import { pesanError } from "@/lib/error";
import { useFormDraft } from "@/lib/useFormDraft";

type Props = {
  produkId: string;
  cabangDefaultId?: string;
  onCatat: (
    tipe: TipeTransaksi,
    jumlah: number,
    cabangId: string,
    lampiranFiles: File[],
    catatan?: string,
    pihak?: string,
    noReferensi?: string,
    dibuatPada?: string,
  ) => Promise<void>;
};

// Batas mundur tanggal manual (harus sinkron dengan validasi di
// supabase/migrasi_tanggal_manual_transaksi.sql).
const MAKS_MUNDUR_HARI = 30;

// Format Date -> value yang dipahami <input type="datetime-local">
// ("YYYY-MM-DDTHH:mm"), memakai waktu LOKAL (bukan UTC) supaya yang
// ditampilkan ke user sesuai jam di perangkatnya.
function keDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// Field draft yang disimpan ke localStorage. Sengaja TIDAK menyertakan
// `lampiran` -- File tidak bisa diserialize ke JSON, jadi bukti tetap
// harus dipilih ulang manual setelah draft dipulihkan.
type DraftTransaksi = {
  jumlah: number | "";
  catatan: string;
  pihak: string;
  noReferensi: string;
  dibuatPada: string;
};

function draftKosong(d: DraftTransaksi) {
  return !d.jumlah && !d.catatan.trim() && !d.pihak.trim() && !d.noReferensi.trim();
}

function formatWaktuSingkat(ts: number) {
  return new Date(ts).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransaksiStokForm({
  produkId,
  cabangDefaultId,
  onCatat,
}: Props) {
  const {
    data: daftarCabang,
    siap: cabangSiap,
    error: errorCabang,
  } = useCabang();
  const { data: stokPerCabang, siap: stokPerCabangSiap } =
    useStokPerCabang(produkId);
  const [cabangId, setCabangId] = useState(cabangDefaultId ?? "");
  const cabangBelumPunyaStok =
    stokPerCabangSiap && cabangId ? !stokPerCabang[cabangId] : false;

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
        {errorCabang && (
          <span className="text-xs text-rust block mt-1.5">
            Gagal memuat daftar cabang: {errorCabang}
          </span>
        )}
        {!errorCabang && cabangBelumPunyaStok && (
          <span className="text-xs text-ink/40 block mt-1.5">
            Barang ini belum punya stok di cabang ini — baris stok baru
            (jumlah awal 0) akan dibuat otomatis saat "Stok Masuk"
            disimpan.
          </span>
        )}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KartuTransaksi
          tipe="masuk"
          produkId={produkId}
          cabangId={cabangId}
          onCatat={onCatat}
        />
        <KartuTransaksi
          tipe="keluar"
          produkId={produkId}
          cabangId={cabangId}
          onCatat={onCatat}
        />
      </div>
    </div>
  );
}

function KartuTransaksi({
  tipe,
  produkId,
  cabangId,
  onCatat,
}: {
  tipe: TipeTransaksi;
  produkId: string;
  cabangId: string;
  onCatat: Props["onCatat"];
}) {
  const [jumlah, setJumlah] = useState<number | "">("");
  const [catatan, setCatatan] = useState("");
  const [pihak, setPihak] = useState("");
  const [noReferensi, setNoReferensi] = useState("");
  const [lampiran, setLampiran] = useState<File[]>([]);
  // Default: waktu sekarang, tapi bisa diubah manual (mis. mencatat
  // transaksi yang sebenarnya terjadi beberapa hari lalu).
  const [dibuatPada, setDibuatPada] = useState(() =>
    keDatetimeLocal(new Date()),
  );
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const masuk = tipe === "masuk";
  const warna = masuk ? "moss" : "rust";
  const Icon = masuk ? ArrowDownToLine : ArrowUpFromLine;

  // Draft/simpan sementara: kalau staf lagi isi transaksi panjang lalu
  // koneksi putus atau salah pencet balik, isian tidak hilang -- otomatis
  // tersimpan di localStorage browser dan bisa dipulihkan lain kali.
  const draftKey = `draft-transaksi-${tipe}-${produkId}`;
  const { draft, draftDitemukan, bersihkan, abaikanTawaran, lastSavedAt } =
    useFormDraft<DraftTransaksi>(
      draftKey,
      { jumlah, catatan, pihak, noReferensi, dibuatPada },
      { isEmpty: draftKosong },
    );

  function pulihkanDraft() {
    if (!draft) return;
    setJumlah(draft.data.jumlah);
    setCatatan(draft.data.catatan);
    setPihak(draft.data.pihak);
    setNoReferensi(draft.data.noReferensi);
    if (draft.data.dibuatPada) setDibuatPada(draft.data.dibuatPada);
    abaikanTawaran();
  }

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
    if (lampiran.length === 0) {
      setError("Unggah minimal 1 bukti (foto/dokumen) transaksi.");
      return;
    }
    if (!dibuatPada) {
      setError("Tanggal & waktu transaksi harus diisi.");
      return;
    }
    const tanggalDipilih = new Date(dibuatPada);
    const sekarang = new Date();
    const batasMundur = new Date(sekarang);
    batasMundur.setDate(batasMundur.getDate() - MAKS_MUNDUR_HARI);
    if (tanggalDipilih > sekarang) {
      setError("Tanggal & waktu transaksi tidak boleh di masa depan.");
      return;
    }
    if (tanggalDipilih < batasMundur) {
      setError(
        `Tanggal & waktu transaksi paling jauh mundur ${MAKS_MUNDUR_HARI} hari dari sekarang.`,
      );
      return;
    }
    setError(null);
    setMenyimpan(true);
    try {
      await onCatat(
        tipe,
        jumlah,
        cabangId,
        lampiran,
        catatan,
        pihak,
        noReferensi,
        tanggalDipilih.toISOString(),
      );
      setJumlah("");
      setCatatan("");
      setPihak("");
      setNoReferensi("");
      setLampiran([]);
      setDibuatPada(keDatetimeLocal(new Date()));
      bersihkan();
    } catch (err) {
      setError(
        pesanError(
          err,
          `Gagal mencatat stok ${masuk ? "masuk" : "keluar"}. Coba lagi.`,
        ),
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

      {draftDitemukan && draft && (
        <div className="mb-4 px-4 py-3 bg-ink/5 border border-ink/10 text-sm rounded-sm flex items-start gap-3">
          <RotateCcw size={15} className="shrink-0 mt-0.5 text-ink/50" />
          <div className="flex-1">
            <p className="text-ink/80">
              Ada draft belum tersimpan dari{" "}
              {formatWaktuSingkat(draft.savedAt)}. Lanjutkan isian itu?
            </p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={pulihkanDraft}
                className="text-xs font-medium text-ink underline underline-offset-2"
              >
                Pulihkan draft
              </button>
              <button
                type="button"
                onClick={bersihkan}
                className="text-xs font-medium text-ink/50 underline underline-offset-2"
              >
                Buang
              </button>
            </div>
          </div>
        </div>
      )}

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

      <label className="block mb-4">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Tanggal & Waktu
        </span>
        <input
          type="datetime-local"
          required
          value={dibuatPada}
          max={keDatetimeLocal(new Date())}
          onChange={(e) => setDibuatPada(e.target.value)}
          className="input font-mono"
        />
        <span className="text-[11px] text-ink/40 block mt-1">
          Default waktu sekarang. Bisa diubah mundur maks. {MAKS_MUNDUR_HARI}{" "}
          hari untuk mencatat transaksi yang terlewat.
        </span>
      </label>

      <label className="block mb-5">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Catatan (opsional)
        </span>
        <input
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder={
            masuk
              ? "cth. Pembelian dari supplier"
              : "cth. Penjualan ke pelanggan"
          }
          className="input"
        />
      </label>

      <label className="block mb-5">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Bukti (foto/dokumen) <span className="text-rust">*wajib</span>
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => {
            const fileBaru = Array.from(e.target.files ?? []);
            if (fileBaru.length === 0) return;
            setLampiran((prev) => [...prev, ...fileBaru]);
            e.target.value = "";
          }}
          className="input file:mr-3 file:px-3 file:py-1.5 file:rounded-sm file:border-0 file:bg-ink/5 file:text-xs file:font-medium file:cursor-pointer"
        />
        <span className="text-[11px] text-ink/40 block mt-1">
          Bisa pilih beberapa file sekaligus dari galeri, atau tambahkan foto
          satu per satu dari kamera.
        </span>

        {lampiran.length > 0 && (
          <ul className="mt-2 border border-ink/10 rounded-sm divide-y divide-ink/10 overflow-hidden">
            {lampiran.map((file, i) => {
              const ukuranKb = Math.round(file.size / 1024);
              const isGambar = file.type.startsWith("image/");
              return (
                <li
                  key={`${file.name}-${file.lastModified}-${i}`}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white hover:bg-paper/60 transition-colors"
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-sm shrink-0 text-[10px] font-mono font-medium ${
                      isGambar
                        ? "bg-moss/10 text-moss"
                        : "bg-ink/10 text-ink/60"
                    }`}
                  >
                    {isGambar ? "IMG" : "DOC"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink/80 truncate">{file.name}</p>
                    <p className="text-[10px] text-ink/40 font-mono">
                      {ukuranKb < 1024
                        ? `${ukuranKb} KB`
                        : `${(ukuranKb / 1024).toFixed(1)} MB`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLampiran((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-sm text-ink/40 hover:text-rust hover:bg-rust/10 transition-colors"
                    aria-label={`Hapus ${file.name}`}
                  >
                    <X size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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

      {lastSavedAt && (
        <p className="text-[11px] text-ink/35 text-center mt-2">
          Draft tersimpan otomatis pukul {formatWaktuSingkat(lastSavedAt)}
          {lampiran.length > 0 ? " (bukti tidak ikut tersimpan)" : ""}
        </p>
      )}
    </form>
  );
}
