"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, ImagePlus, RotateCcw, X } from "lucide-react";
import { AlasanOpname, Barang } from "@/lib/types";
import { useCabang } from "@/lib/storage";
import { pesanError } from "@/lib/error";
import { useFormDraft } from "@/lib/useFormDraft";

const LABEL_ALASAN: Record<AlasanOpname, string> = {
  rusak: "Barang rusak",
  hilang: "Barang hilang",
  salah_catat: "Salah catat sebelumnya",
  lainnya: "Lainnya",
};

// Field draft yang disimpan ke localStorage. Sengaja TIDAK menyertakan
// `foto` -- File tidak bisa diserialize ke JSON, jadi foto bukti tetap
// harus dipilih ulang manual setelah draft dipulihkan.
type DraftOpname = {
  stokFisik: number | "";
  alasan: AlasanOpname | "";
  catatan: string;
};

function draftKosong(d: DraftOpname) {
  return !d.stokFisik && !d.alasan && !d.catatan.trim();
}

function formatWaktuSingkat(ts: number) {
  return new Date(ts).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Batas ukuran & jumlah foto, dijaga di sisi client supaya user dapat
// pesan error yang jelas sebelum upload dicoba (sama pola dengan
// TransferStokTable/TransaksiStokForm).
const MAKS_UKURAN_FOTO_MB = 5;
const MAKS_JUMLAH_FOTO = 6;

type Props = {
  barang: Barang;
  onCatat: (
    cabangId: string,
    stokFisik: number,
    alasan?: string,
    catatan?: string,
    lampiranFiles?: File[],
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
  // Foto bukti hitung fisik -- OPSIONAL, boleh lebih dari satu.
  const [foto, setFoto] = useState<File[]>([]);
  const [previewFoto, setPreviewFoto] = useState<string[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  useEffect(() => {
    setCabangId(barang.cabangId);
  }, [barang.cabangId]);

  // Draft/simpan sementara per barang, supaya hasil hitung fisik yang
  // sedang diketik tidak hilang kalau koneksi putus atau salah pencet
  // balik sebelum sempat submit.
  const draftKey = `draft-opname-${barang.id}`;
  const { draft, draftDitemukan, bersihkan, abaikanTawaran, lastSavedAt } =
    useFormDraft<DraftOpname>(
      draftKey,
      { stokFisik, alasan, catatan },
      { isEmpty: draftKosong },
    );

  function pulihkanDraft() {
    if (!draft) return;
    setStokFisik(draft.data.stokFisik);
    setAlasan(draft.data.alasan);
    setCatatan(draft.data.catatan);
    abaikanTawaran();
  }

  // Bersihkan semua object URL preview saat komponen unmount (mis.
  // user pindah halaman sebelum submit) -- tanpa ini, blob URL yang
  // sudah dibuat lewat URL.createObjectURL tetap menempel di memori
  // browser walau komponennya sudah hilang. Pakai ref (bukan
  // dependency [previewFoto]) supaya cleanup ini hanya jalan sekali
  // saat unmount, tapi tetap membaca daftar URL yang PALING BARU
  // (bukan snapshot basi dari render pertama).
  const previewFotoRef = useRef(previewFoto);
  previewFotoRef.current = previewFoto;
  useEffect(() => {
    return () => {
      previewFotoRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const stokSistem = useMemo(
    () => barang.stokPerCabang.find((s) => s.cabangId === cabangId)?.jumlah,
    [barang.stokPerCabang, cabangId],
  );

  const selisih =
    stokFisik === "" || stokSistem === undefined
      ? null
      : stokFisik - stokSistem;

  function tambahFoto(files: FileList | null) {
    if (!files || files.length === 0) return;
    const dipilih = Array.from(files);

    if (foto.length + dipilih.length > MAKS_JUMLAH_FOTO) {
      setError(`Maksimal ${MAKS_JUMLAH_FOTO} foto per opname.`);
      return;
    }
    for (const file of dipilih) {
      if (!file.type.startsWith("image/")) {
        setError("File harus berupa gambar (JPG, PNG, dsb).");
        return;
      }
      if (file.size > MAKS_UKURAN_FOTO_MB * 1024 * 1024) {
        setError(`Ukuran tiap foto maksimal ${MAKS_UKURAN_FOTO_MB}MB.`);
        return;
      }
    }
    setError(null);
    setFoto((f) => [...f, ...dipilih]);
    setPreviewFoto((p) => [
      ...p,
      ...dipilih.map((f) => URL.createObjectURL(f)),
    ]);
  }

  function hapusFoto(index: number) {
    URL.revokeObjectURL(previewFoto[index]);
    setFoto((f) => f.filter((_, i) => i !== index));
    setPreviewFoto((p) => p.filter((_, i) => i !== index));
  }

  function resetFoto() {
    previewFoto.forEach((url) => URL.revokeObjectURL(url));
    setFoto([]);
    setPreviewFoto([]);
  }

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
    // Sama seperti transaksi manual yang wajib bukti foto: kalau ada
    // selisih (stok dikoreksi), foto jadi wajib supaya standar bukti
    // auditnya konsisten. Kalau hasilnya cocok, tetap opsional.
    if (selisih !== null && selisih !== 0 && foto.length === 0) {
      setError(
        "Ada selisih dengan stok sistem — unggah minimal 1 foto bukti hitung fisik.",
      );
      return;
    }

    setError(null);
    setMenyimpan(true);
    try {
      const alasanLabel = alasan ? LABEL_ALASAN[alasan] : undefined;
      await onCatat(cabangId, stokFisik, alasanLabel, catatan, foto);
      setSukses(
        selisih === 0 || selisih === null
          ? "Opname dicatat. Stok sistem sudah cocok dengan hitungan fisik."
          : `Opname dicatat. Stok dikoreksi ${selisih! > 0 ? "+" : ""}${selisih} (${alasanLabel}).`,
      );
      setStokFisik("");
      setAlasan("");
      setCatatan("");
      resetFoto();
      bersihkan();
    } catch (err) {
      setError(pesanError(err, "Gagal mencatat stok opname."));
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

      <label className="block mb-4">
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

      <div className="block mb-5">
        <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
          Foto bukti hitung fisik{" "}
          {selisih !== null && selisih !== 0 ? (
            <span className="text-rust">*wajib (ada selisih)</span>
          ) : (
            "(opsional)"
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          {previewFoto.map((url, i) => (
            <div
              key={url}
              className="relative w-16 h-16 rounded-sm overflow-hidden border border-ink/15 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto bukti ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => hapusFoto(i)}
                className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-paper transition-opacity"
                aria-label="Hapus foto"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {foto.length < MAKS_JUMLAH_FOTO && (
            <label className="w-16 h-16 flex flex-col items-center justify-center gap-1 border border-dashed border-ink/25 rounded-sm text-ink/40 hover:text-ink/70 hover:border-ink/40 cursor-pointer transition-colors">
              <ImagePlus size={18} />
              <span className="text-[10px]">Tambah</span>
              {/* Sengaja TIDAK pakai capture="environment" -- sama
                  seperti konvensi di TransaksiStokForm. Kalau
                  dibarengin dengan `multiple`, banyak browser mobile
                  jadi cuma bisa buka kamera (1 foto per klik) dan
                  gak bisa multi-select dari galeri. */}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  tambahFoto(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="text-[11px] text-ink/40 mt-1.5">
          Boleh lebih dari satu foto, maksimal {MAKS_JUMLAH_FOTO}.{" "}
          {selisih !== null && selisih !== 0
            ? "Wajib diisi karena ada selisih dengan stok sistem."
            : "Tidak wajib diisi kalau hasilnya cocok."}
        </p>
      </div>

      <button
        type="submit"
        disabled={menyimpan}
        className="w-full px-5 py-2.5 text-sm font-medium rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-ink text-paper hover:bg-ink/90"
      >
        {menyimpan ? "Menyimpan..." : "Catat Hasil Opname"}
      </button>

      {lastSavedAt && (
        <p className="text-[11px] text-ink/35 text-center mt-2">
          Draft tersimpan otomatis pukul {formatWaktuSingkat(lastSavedAt)}
          {foto.length > 0 ? " (foto tidak ikut tersimpan)" : ""}
        </p>
      )}
    </form>
  );
}
