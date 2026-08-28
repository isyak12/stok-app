"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarangInput, Barang } from "@/lib/types";
import { useCabang, useStokPerCabang } from "@/lib/storage";
import { Peran, adalahAdminAtauLebih } from "@/lib/role";
import { Lock } from "lucide-react";

type Props = {
  awal?: Barang;
  onSimpan: (input: BarangInput) => Promise<void>;
  judul: string;
  peran?: Peran;
};

const KATEGORI_UMUM = [
  "Elektronik",
  "Alat Tulis",
  "Sembako",
  "Perawatan Rumah",
  "Pakaian",
  "Lainnya",
];

export default function StokForm({
  awal,
  onSimpan,
  judul,
  peran = "admin",
}: Props) {
  const router = useRouter();
  const modeEdit = Boolean(awal);
  // Field data master (nama/sku/kategori/harga) hanya boleh diubah admin.
  // Di mode Tambah, seluruh form tetap dianggap boleh diisi -- halaman
  // pemanggilnya (stok/tambah) sudah memblokir akses staf ke mode ini
  // lebih dulu.
  const kunciMaster = modeEdit && !adalahAdminAtauLebih(peran);
  // Stok minimum adalah ambang batas alert "stok menipis" di Dasbor --
  // ini keputusan kebijakan gudang, bukan tugas harian staf, jadi
  // dikunci dengan syarat yang sama seperti kunciMaster (bukan berarti
  // sama tabelnya -- stok_minimum ada di tabel `stok`, bukan `produk`).
  // Lihat trigger cegah_staf_ubah_stok_minimum() di
  // supabase/migrasi_kunci_stok_minimum.sql -- kunci di sini murni UX,
  // pembatasan sebenarnya ada di database.
  const kunciStokMinimum = modeEdit && !adalahAdminAtauLebih(peran);
  const { data: daftarCabang, siap: cabangSiap } = useCabang();
  // Stok per-cabang produk ini (kosong kalau mode Tambah, karena belum ada id)
  const { data: stokPerCabang, siap: stokPerCabangSiap } = useStokPerCabang(
    awal?.id,
  );

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

  // Begitu data stok per-cabang produk ini selesai dimuat, pastikan
  // field jumlah/stokMinimum/lokasi cocok dengan cabang yang lagi
  // terpilih (bukan angka gabungan semua cabang dari `awal`).
  useEffect(() => {
    if (!modeEdit || !stokPerCabangSiap || !form.cabangId) return;
    const nilai = stokPerCabang[form.cabangId];
    setForm((f) => ({
      ...f,
      jumlah: nilai?.jumlah ?? 0,
      stokMinimum: nilai?.stokMinimum ?? 0,
      lokasi: nilai?.lokasi ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stokPerCabangSiap]);

  function ubah<K extends keyof BarangInput>(kunci: K, nilai: BarangInput[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }));
  }

  function ubahCabang(cabangIdBaru: string) {
    if (modeEdit) {
      // Ganti cabang di mode edit -> muatkan angka stok milik cabang itu
      const nilai = stokPerCabang[cabangIdBaru];
      setForm((f) => ({
        ...f,
        cabangId: cabangIdBaru,
        jumlah: nilai?.jumlah ?? 0,
        stokMinimum: nilai?.stokMinimum ?? 0,
        lokasi: nilai?.lokasi ?? "",
      }));
    } else {
      // Mode tambah: cuma satu baris stok baru, tidak perlu muat apa pun
      setForm((f) => ({ ...f, cabangId: cabangIdBaru }));
    }
  }

  const produkBelumAdaDiCabangIni =
    modeEdit &&
    stokPerCabangSiap &&
    form.cabangId &&
    !stokPerCabang[form.cabangId];

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
      <h2 className="font-display text-lg font-semibold mb-1">{judul}</h2>

      {kunciMaster && (
        <p className="text-xs text-ink/50 flex items-center gap-1.5 mb-2">
          <Lock size={12} />
          SKU, nama, kategori, harga & stok minimum hanya bisa diubah oleh
          admin. Kamu tetap bisa memperbarui lokasi di bawah.
        </p>
      )}
      {modeEdit && (
        <p className="text-xs text-ink/50 flex items-center gap-1.5 mb-5">
          <Lock size={12} />
          Jumlah stok tidak bisa diubah manual oleh siapa pun di sini --
          gunakan menu Transaksi Stok, Transfer, atau Stok Opname.
        </p>
      )}
      {!kunciMaster && !modeEdit && <div className="mb-6" />}

      {error && (
        <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Kode SKU">
          <input
            required
            disabled={kunciMaster}
            value={form.sku}
            onChange={(e) => ubah("sku", e.target.value)}
            placeholder="cth. ELK-0099"
            className="input font-mono disabled:bg-paper disabled:text-ink/50"
          />
        </Field>

        <Field label="Kategori">
          <select
            disabled={kunciMaster}
            value={form.kategori}
            onChange={(e) => ubah("kategori", e.target.value)}
            className="input disabled:bg-paper disabled:text-ink/50"
          >
            {KATEGORI_UMUM.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>

        <Field label="Cabang" span2>
          <select
            required
            value={form.cabangId}
            onChange={(e) => ubahCabang(e.target.value)}
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
          {modeEdit && (
            <span className="text-xs text-ink/40 block mt-1.5">
              {!stokPerCabangSiap
                ? "Memuat data stok per cabang..."
                : produkBelumAdaDiCabangIni
                  ? "Barang ini belum punya stok di cabang ini — akan dibuat baris baru saat disimpan."
                  : "Jumlah, stok minimum & lokasi di bawah mengikuti cabang yang dipilih."}
            </span>
          )}
        </Field>

        <Field label="Nama Barang" span2>
          <input
            required
            disabled={kunciMaster}
            value={form.nama}
            onChange={(e) => ubah("nama", e.target.value)}
            placeholder="cth. Kabel HDMI 2m"
            className="input disabled:bg-paper disabled:text-ink/50"
          />
        </Field>

        <Field label="Jumlah Stok">
          <input
            type="number"
            min={0}
            disabled={modeEdit}
            readOnly={modeEdit}
            value={form.jumlah}
            onChange={(e) => ubah("jumlah", Number(e.target.value))}
            className="input font-mono disabled:bg-paper disabled:text-ink/50"
          />
          {modeEdit ? (
            <span className="text-xs text-ink/40 block mt-1.5">
              Tidak bisa diubah di sini. Gunakan menu Transaksi Stok
              (barang masuk/keluar), Transfer, atau Stok Opname supaya
              perubahan tercatat di riwayat.
            </span>
          ) : (
            <span className="text-xs text-ink/40 block mt-1.5">
              Jumlah stok awal untuk barang baru ini di cabang yang
              dipilih.
            </span>
          )}
        </Field>

        <Field label="Satuan">
          <input
            disabled={kunciMaster}
            value={form.satuan}
            onChange={(e) => ubah("satuan", e.target.value)}
            placeholder="pcs / kg / box"
            className="input disabled:bg-paper disabled:text-ink/50"
          />
        </Field>

        <Field label="Stok Minimum">
          <input
            type="number"
            min={0}
            disabled={kunciStokMinimum}
            value={form.stokMinimum}
            onChange={(e) => ubah("stokMinimum", Number(e.target.value))}
            className="input font-mono disabled:bg-paper disabled:text-ink/50"
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
            disabled={kunciMaster}
            value={form.hargaBeli}
            onChange={(e) => ubah("hargaBeli", Number(e.target.value))}
            className="input font-mono disabled:bg-paper disabled:text-ink/50"
          />
        </Field>

        <Field label="Harga Jual (Rp)">
          <input
            type="number"
            min={0}
            disabled={kunciMaster}
            value={form.hargaJual}
            onChange={(e) => ubah("hargaJual", Number(e.target.value))}
            className="input font-mono disabled:bg-paper disabled:text-ink/50"
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
