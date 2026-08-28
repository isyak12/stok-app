"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import {
  Barang,
  BarangInput,
  Cabang,
  LogAktivitasBarang,
  MutasiStok,
  StokCabangValues,
  StokOpname,
  TipeTransaksi,
  TransaksiStok,
  TransferMenunggu,
  TransferStok,
} from "./types";

const supabase = createClient();

// Bentuk baris hasil join produk + stok dari Supabase
type BarisProduk = {
  id: string;
  sku: string;
  nama: string;
  kategori: string;
  satuan: string;
  harga_beli: number;
  harga_jual: number;
  dibuat_pada: string;
  stok: {
    jumlah: number;
    stok_minimum: number;
    lokasi: string;
    cabang_id: string;
    diperbarui_pada: string;
  }[];
};

function keBarang(baris: BarisProduk): Barang {
  // Urutkan dulu berdasarkan cabang_id supaya "cabang default" yang
  // dipakai di bawah (stokUtama) konsisten setiap kali data dimuat —
  // sebelumnya dipakai semuaStok[0] apa adanya, padahal urutan baris
  // nested yang dikembalikan Supabase tidak dijamin sama tiap request.
  const semuaStok = [...(baris.stok ?? [])].sort((a, b) =>
    a.cabang_id.localeCompare(b.cabang_id),
  );
  const totalJumlah = semuaStok.reduce((sum, s) => sum + s.jumlah, 0);
  const stokUtama = semuaStok[0]; // dipakai untuk stokMinimum, lokasi, cabangId default

  // PENTING: stok rendah dicek PER CABANG (jumlah cabang itu <= minimum
  // cabang itu), bukan totalJumlah (gabungan semua cabang) dibandingkan
  // stokMinimum satu cabang saja. Kalau dibandingkan pakai total gabungan,
  // produk dengan banyak cabang bisa terlihat "aman" padahal salah satu
  // cabangnya sudah kritis, atau sebaliknya salah tampil rendah.
  const stokRendah = semuaStok.some((s) => s.jumlah <= s.stok_minimum);

  return {
    id: baris.id,
    sku: baris.sku,
    nama: baris.nama,
    kategori: baris.kategori,
    satuan: baris.satuan,
    hargaBeli: Number(baris.harga_beli),
    hargaJual: Number(baris.harga_jual),
    jumlah: totalJumlah,
    stokMinimum: stokUtama?.stok_minimum ?? 0,
    lokasi: stokUtama?.lokasi ?? "",
    cabangId: stokUtama?.cabang_id ?? "",
    diperbaruiPada: stokUtama?.diperbarui_pada ?? baris.dibuat_pada,
    stokRendah,
    stokPerCabang: semuaStok.map((s) => ({
      cabangId: s.cabang_id,
      jumlah: s.jumlah,
      stokMinimum: s.stok_minimum,
      rendah: s.jumlah <= s.stok_minimum,
      lokasi: s.lokasi,
    })),
  };
}

const SELECT_QUERY =
  "id, sku, nama, kategori, satuan, harga_beli, harga_jual, dibuat_pada, stok(jumlah, stok_minimum, lokasi, cabang_id, diperbarui_pada)";

/**
 * Hook utama untuk mengakses dan mengubah data stok barang.
 * Data disimpan di Supabase (tabel `produk` + `stok`).
 */
export function useStok() {
  const [data, setData] = useState<Barang[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    const { data: baris, error } = await supabase
      .from("produk")
      .select(SELECT_QUERY)
      .order("nama", { ascending: true });

    if (error) {
      setError(error.message);
      setSiap(true);
      return;
    }
    setError(null);
    setData(((baris ?? []) as unknown as BarisProduk[]).map(keBarang));
    setSiap(true);
  }, []);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  const tambah = useCallback(
    async (input: BarangInput) => {
      const { data: produkBaru, error: errProduk } = await supabase
        .from("produk")
        .insert({
          sku: input.sku,
          nama: input.nama,
          kategori: input.kategori,
          satuan: input.satuan,
          harga_beli: input.hargaBeli,
          harga_jual: input.hargaJual,
        })
        .select("id")
        .single();

      if (errProduk || !produkBaru) {
        setError(errProduk?.message ?? "Gagal menambah produk");
        throw errProduk ?? new Error("Gagal menambah produk");
      }

      const { error: errStok } = await supabase.from("stok").insert({
        produk_id: produkBaru.id,
        cabang_id: input.cabangId,
        jumlah: input.jumlah,
        stok_minimum: input.stokMinimum,
        lokasi: input.lokasi,
      });

      if (errStok) {
        // rollback: hapus produk yang baru dibuat, biar nggak jadi data hantu
        await supabase.from("produk").delete().eq("id", produkBaru.id);
        setError(errStok.message);
        throw errStok;
      }

      await muatUlang();
    },
    [muatUlang],
  );

  const perbarui = useCallback(
    async (id: string, input: BarangInput) => {
      // PENTING: validasi cabangId dilakukan PALING AWAL, sebelum update
      // apa pun. Sebelumnya validasi ini ada setelah update tabel `produk`,
      // sehingga kalau cabangId kosong, data produk sudah kadung ter-update
      // tapi stok tidak — meninggalkan data dalam keadaan tidak konsisten
      // (partial write).
      if (!input.cabangId) {
        const pesan = "Pilih cabang terlebih dahulu.";
        setError(pesan);
        throw new Error(pesan);
      }

      const { data: produkTerupdate, error: errProduk } = await supabase
        .from("produk")
        .update({
          sku: input.sku,
          nama: input.nama,
          kategori: input.kategori,
          satuan: input.satuan,
          harga_beli: input.hargaBeli,
          harga_jual: input.hargaJual,
        })
        .eq("id", id)
        .select("id");

      if (errProduk) {
        setError(errProduk.message);
        throw errProduk;
      }
      if (!produkTerupdate || produkTerupdate.length === 0) {
        const pesan =
          "Barang tidak ditemukan atau Anda tidak punya izin mengubahnya (cek RLS policy di Supabase).";
        setError(pesan);
        throw new Error(pesan);
      }

      // PENTING: filter juga berdasarkan cabang_id, bukan cuma produk_id.
      // Tanpa ini, produk yang punya stok di lebih dari satu cabang akan
      // ketimpa SEMUA cabangnya dengan nilai yang sama saat diedit.
      const { data: stokTerupdate, error: errStok } = await supabase
        .from("stok")
        .update({
          jumlah: input.jumlah,
          stok_minimum: input.stokMinimum,
          lokasi: input.lokasi,
        })
        .eq("produk_id", id)
        .eq("cabang_id", input.cabangId)
        .select("id");

      if (errStok) {
        setError(errStok.message);
        throw errStok;
      }
      if (!stokTerupdate || stokTerupdate.length === 0) {
        // Produk ini belum punya baris stok di cabang yang dipilih — buat baru.
        const { error: errInsertStok } = await supabase.from("stok").insert({
          produk_id: id,
          cabang_id: input.cabangId,
          jumlah: input.jumlah,
          stok_minimum: input.stokMinimum,
          lokasi: input.lokasi,
        });
        if (errInsertStok) {
          setError(errInsertStok.message);
          throw errInsertStok;
        }
      }

      await muatUlang();
    },
    [muatUlang],
  );

  const hapus = useCallback(async (id: string) => {
    // Menghapus produk otomatis menghapus baris stok terkait (ON DELETE CASCADE)
    const { error } = await supabase.from("produk").delete().eq("id", id);
    if (error) {
      setError(error.message);
      throw error;
    }
    setData((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const cariById = useCallback(
    (id: string) => data.find((b) => b.id === id),
    [data],
  );

  return { data, siap, error, tambah, perbarui, hapus, cariById, muatUlang };
}

/**
 * Hook untuk membaca stok satu produk DI SETIAP CABANG (bukan agregat).
 * Dipakai form edit supaya saat pengguna ganti pilihan cabang, angka
 * jumlah/stok minimum/lokasi yang tampil sesuai cabang itu — bukan
 * ikut-ikutan angka cabang lain atau angka gabungan semua cabang.
 *
 * Mengembalikan peta: { [cabangId]: { jumlah, stokMinimum, lokasi } }
 * Produk yang belum punya stok di suatu cabang, cukup tidak ada
 * entry-nya di peta ini (form akan anggap 0 / kosong).
 */
export function useStokPerCabang(produkId?: string) {
  const [data, setData] = useState<Record<string, StokCabangValues>>({});
  const [siap, setSiap] = useState(!produkId);

  useEffect(() => {
    if (!produkId) {
      setData({});
      setSiap(true);
      return;
    }

    let batal = false;
    setSiap(false);

    supabase
      .from("stok")
      .select("cabang_id, jumlah, stok_minimum, lokasi")
      .eq("produk_id", produkId)
      .then(({ data: baris, error }) => {
        if (batal) return;
        if (error) {
          setData({});
          setSiap(true);
          return;
        }
        const peta: Record<string, StokCabangValues> = {};
        (baris ?? []).forEach((b) => {
          peta[b.cabang_id] = {
            jumlah: b.jumlah,
            stokMinimum: b.stok_minimum,
            lokasi: b.lokasi,
          };
        });
        setData(peta);
        setSiap(true);
      });

    return () => {
      batal = true;
    };
  }, [produkId]);

  return { data, siap };
}

// Bentuk baris tabel transaksi_stok dari Supabase
type BarisTransaksiStok = {
  id: string;
  produk_id: string;
  cabang_id: string;
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
  dibuat_pada: string;
  dibuat_oleh_nama: string | null;
  pihak: string | null;
  no_referensi: string | null;
  dibatalkan: boolean;
  dibatalkan_oleh_nama: string | null;
  dibatalkan_pada: string | null;
  alasan_pembatalan: string | null;
  transaksi_stok_lampiran?: { url: string }[];
};

function keTransaksiStok(baris: BarisTransaksiStok): TransaksiStok {
  return {
    id: baris.id,
    produkId: baris.produk_id,
    cabangId: baris.cabang_id,
    tipe: baris.tipe,
    jumlah: baris.jumlah,
    catatan: baris.catatan,
    dibuatPada: baris.dibuat_pada,
    dibuatOlehNama: baris.dibuat_oleh_nama,
    pihak: baris.pihak,
    noReferensi: baris.no_referensi,
    dibatalkan: baris.dibatalkan,
    dibatalkanOlehNama: baris.dibatalkan_oleh_nama,
    dibatalkanPada: baris.dibatalkan_pada,
    alasanPembatalan: baris.alasan_pembatalan,
    lampiranUrls: (baris.transaksi_stok_lampiran ?? []).map((l) => l.url),
  };
}

/**
 * Hook untuk membaca riwayat transaksi stok satu produk dan mencatat
 * transaksi baru (stok masuk/keluar) lewat Postgres function
 * `catat_transaksi_stok`.
 */
export function useTransaksiStok(produkId: string) {
  const [data, setData] = useState<TransaksiStok[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    const { data: baris, error } = await supabase
      .from("transaksi_stok")
      .select(
        "id, produk_id, cabang_id, tipe, jumlah, catatan, dibuat_pada, dibuat_oleh_nama, pihak, no_referensi, dibatalkan, dibatalkan_oleh_nama, dibatalkan_pada, alasan_pembatalan, transaksi_stok_lampiran(url)",
      )
      .eq("produk_id", produkId)
      .order("dibuat_pada", { ascending: false });

    if (error) {
      setError(error.message);
      setSiap(true);
      return;
    }
    setError(null);
    setData(((baris ?? []) as BarisTransaksiStok[]).map(keTransaksiStok));
    setSiap(true);
  }, [produkId]);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  const NAMA_BUCKET_BUKTI = "bukti-transaksi";

  // Mengembalikan path Storage (bukan URL publik) di samping URL, supaya
  // uploadLampiran bisa membersihkan file itu lagi kalau langkah
  // berikutnya (RPC catat_transaksi_stok) gagal.
  async function uploadLampiran(
    produkId: string,
    files: File[],
  ): Promise<{ url: string; path: string }[]> {
    const hasilUpload: { url: string; path: string }[] = [];
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${produkId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .upload(path, file);
        if (error) {
          throw new Error(
            `Gagal mengunggah lampiran (${file.name}): ${error.message}`,
          );
        }
        const { data } = supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .getPublicUrl(path);
        hasilUpload.push({ url: data.publicUrl, path });
      }
      return hasilUpload;
    } catch (err) {
      // Salah satu file gagal diunggah di tengah jalan -- bersihkan
      // file-file sebelumnya yang sudah kadung terunggah di percobaan
      // ini, supaya tidak jadi sampah tak terpakai di bucket.
      if (hasilUpload.length > 0) {
        await supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .remove(hasilUpload.map((f) => f.path))
          .catch(() => {
            // Gagal membersihkan bukan hal fatal -- error asli (upload)
            // yang lebih penting untuk ditampilkan ke user.
          });
      }
      throw err;
    }
  }

  // Catat transaksi stok masuk/keluar baru. Bukti (foto/dokumen) wajib
  // diunggah dulu ke storage, baru URL-nya dikirim ke Postgres function
  // `catat_transaksi_stok` (lihat supabase/transaksi_stok.sql) yang
  // menjamin update jumlah stok + insert baris riwayat berjalan atomik.
  const catat = useCallback(
    async (
      tipe: TipeTransaksi,
      jumlah: number,
      cabangId: string,
      lampiranFiles: File[],
      catatan?: string,
      pihak?: string,
      noReferensi?: string,
      dibuatPada?: string,
    ) => {
      if (!lampiranFiles || lampiranFiles.length === 0) {
        throw new Error("Bukti (foto/dokumen) wajib diunggah minimal 1 file.");
      }

      const lampiran = await uploadLampiran(produkId, lampiranFiles);

      const { error } = await supabase.rpc("catat_transaksi_stok", {
        p_produk_id: produkId,
        p_cabang_id: cabangId,
        p_tipe: tipe,
        p_jumlah: jumlah,
        p_lampiran_urls: lampiran.map((f) => f.url),
        p_catatan: catatan?.trim() ? catatan.trim() : null,
        p_pihak: pihak?.trim() ? pihak.trim() : null,
        p_no_referensi: noReferensi?.trim() ? noReferensi.trim() : null,
        p_dibuat_pada: dibuatPada ? dibuatPada : null,
      });

      if (error) {
        // RPC gagal (mis. stok tidak cukup) SETELAH file sudah
        // terunggah -- hapus lagi file-file itu supaya tidak jadi
        // sampah yatim di bucket "bukti-transaksi" tanpa transaksi
        // yang mengacu ke situ.
        await supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .remove(lampiran.map((f) => f.path))
          .catch(() => {
            // Gagal membersihkan bukan hal fatal -- error asli (RPC)
            // yang lebih penting untuk dilempar ke pemanggil.
          });
        throw error;
      }

      await muatUlang();
    },
    [produkId, muatUlang],
  );

  // Batalkan (void) transaksi yang salah catat: mengoreksi balik efeknya
  // ke stok (lihat supabase/pembatalan_transaksi.sql, function
  // batalkan_transaksi_stok). Baris transaksi tetap ada di riwayat,
  // hanya ditandai dibatalkan + siapa/kapan/kenapa — bukan dihapus,
  // supaya jejak audit utuh. Transaksi yang sudah dibatalkan akan
  // ditolak function di sisi database kalau dicoba dibatalkan lagi.
  const batalkan = useCallback(
    async (transaksiId: string, alasan?: string) => {
      const { error } = await supabase.rpc("batalkan_transaksi_stok", {
        p_transaksi_id: transaksiId,
        p_alasan: alasan?.trim() ? alasan.trim() : null,
      });

      if (error) {
        throw error;
      }

      await muatUlang();
    },
    [muatUlang],
  );

  return { data, siap, error, catat, batalkan, muatUlang };
}

/**
 * Hook untuk mengambil daftar cabang (dipakai di dropdown form).
 */
export function useCabang() {
  const [data, setData] = useState<Cabang[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("cabang")
      .select("id, nama, kode")
      .order("nama", { ascending: true })
      .then(({ data, error }) => {
        setError(error ? error.message : null);
        setData(data ?? []);
        setSiap(true);
      });
  }, []);

  return { data, siap, error };
}

// Bentuk baris hasil query transfer_stok(status=terkirim) + join produk,
// dipakai khusus untuk notifikasi "transfer menunggu konfirmasi".
type BarisTransferMenunggu = {
  id: string;
  produk_id: string;
  dari_cabang_id: string;
  ke_cabang_id: string;
  jumlah: number;
  dibuat_pada: string;
  dibuat_oleh_nama: string | null;
  produk: { nama: string; sku: string } | { nama: string; sku: string }[] | null;
};

/**
 * Hook untuk notifikasi "transfer menunggu konfirmasi" (lonceng di
 * Sidebar) -- mengambil SEMUA transfer berstatus 'terkirim' lintas
 * cabang (bukan cuma satu produk seperti useTransferStok), supaya
 * staf tahu ada barang masuk yang perlu dikonfirmasi tanpa harus
 * membuka satu-satu halaman transfer tiap produk.
 *
 * CATATAN PENTING: aplikasi ini belum punya konsep "staf ini
 * ditugaskan di cabang X" (lihat lib/useUser.ts) -- peran cuma
 * admin/staf/superadmin, tidak terikat cabang tertentu. Jadi
 * notifikasi ini SENGAJA menampilkan transfer masuk ke SEMUA cabang,
 * bukan difilter per cabang staf yang login. Kalau nanti aplikasi
 * menambah konsep user<->cabang, filter di sini tinggal ditambah
 * `.eq("ke_cabang_id", cabangSaya)`.
 *
 * Auto-refresh lewat Supabase Realtime saat ada transfer baru
 * dicatat / dikonfirmasi / dibatalkan -- BUKAN polling -- supaya
 * badge selalu akurat tanpa membebani database dengan query berulang.
 * Realtime butuh tabel transfer_stok didaftarkan ke publication
 * `supabase_realtime` di sisi Supabase (lihat
 * supabase/migrasi_realtime_transfer.sql) -- kalau belum, hook ini
 * tetap jalan (data awal tetap tampil), hanya saja tidak auto-update
 * sampai halaman di-refresh manual.
 */
export function useTransferMenunggu() {
  const [data, setData] = useState<TransferMenunggu[]>([]);
  const [siap, setSiap] = useState(false);
  // PENTING: nama channel Realtime HARUS unik per instance komponen.
  // Hook ini dipanggil lebih dari sekali secara bersamaan (Sidebar
  // me-render <NotifikasiTransferMasuk /> dua kali -- versi mobile
  // & desktop -- yang disembunyikan lewat CSS "hidden", BUKAN
  // unmount). Kalau nama channel sama persis di semua instance,
  // Supabase realtime-js menganggapnya topic yang sama dan instance
  // kedua akan gagal .subscribe() dengan error "cannot add
  // postgres_changes callbacks ... after subscribe()" -- ini yang
  // bikin seluruh halaman crash (client-side exception), bukan cuma
  // notifikasi yang gagal.
  const idInstance = useId();

  const muatUlang = useCallback(async () => {
    const { data: baris, error } = await supabase
      .from("transfer_stok")
      .select(
        "id, produk_id, dari_cabang_id, ke_cabang_id, jumlah, dibuat_pada, dibuat_oleh_nama, produk(nama, sku)",
      )
      .eq("status", "terkirim")
      .order("dibuat_pada", { ascending: true });

    if (error) {
      // Notifikasi ini bersifat pelengkap (bukan halaman utama) --
      // kalau gagal dimuat, diam saja (daftar kosong) daripada
      // menampilkan error yang mengganggu di seluruh halaman dasbor.
      setSiap(true);
      return;
    }

    setData(
      ((baris ?? []) as BarisTransferMenunggu[]).map((b) => {
        const produk = Array.isArray(b.produk) ? b.produk[0] : b.produk;
        return {
          id: b.id,
          produkId: b.produk_id,
          produkNama: produk?.nama ?? "Produk tidak diketahui",
          produkSku: produk?.sku ?? "",
          dariCabangId: b.dari_cabang_id,
          keCabangId: b.ke_cabang_id,
          jumlah: b.jumlah,
          dibuatPada: b.dibuat_pada,
          dibuatOlehNama: b.dibuat_oleh_nama,
        };
      }),
    );
    setSiap(true);
  }, []);

  useEffect(() => {
    muatUlang();

    const channel = supabase
      .channel(`transfer_stok_menunggu:${idInstance}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfer_stok" },
        () => {
          muatUlang();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [muatUlang, idInstance]);

  return { data, siap, muatUlang };
}

// Bentuk baris tabel transfer_stok dari Supabase
type BarisTransferStok = {
  id: string;
  produk_id: string;
  dari_cabang_id: string;
  ke_cabang_id: string;
  jumlah: number;
  catatan: string | null;
  dibuat_pada: string;
  status: TransferStok["status"];
  dibuat_oleh_nama: string | null;
  diterima_oleh_nama: string | null;
  diterima_pada: string | null;
  dibatalkan_oleh_nama: string | null;
  dibatalkan_pada: string | null;
  alasan_pembatalan: string | null;
  bukti_foto_url: string | null;
  catatan_penerimaan: string | null;
};

function keTransferStok(baris: BarisTransferStok): TransferStok {
  return {
    id: baris.id,
    produkId: baris.produk_id,
    dariCabangId: baris.dari_cabang_id,
    keCabangId: baris.ke_cabang_id,
    jumlah: baris.jumlah,
    catatan: baris.catatan,
    dibuatPada: baris.dibuat_pada,
    status: baris.status,
    dibuatOlehNama: baris.dibuat_oleh_nama,
    diterimaOlehNama: baris.diterima_oleh_nama,
    diterimaPada: baris.diterima_pada,
    dibatalkanOlehNama: baris.dibatalkan_oleh_nama,
    dibatalkanPada: baris.dibatalkan_pada,
    alasanPembatalan: baris.alasan_pembatalan,
    buktiFotoUrl: baris.bukti_foto_url,
    catatanPenerimaan: baris.catatan_penerimaan,
  };
}

/**
 * Hook untuk membaca riwayat transfer stok satu produk dan mencatat
 * transfer baru (pindah stok antar cabang) lewat Postgres function
 * `catat_transfer_stok`. Function di sisi database yang menjamin
 * perpindahan jumlah antar 2 baris stok + pencatatan riwayat
 * berjalan atomik (lihat supabase/transfer_stok.sql).
 */
export function useTransferStok(produkId: string) {
  const [data, setData] = useState<TransferStok[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    const { data: baris, error } = await supabase
      .from("transfer_stok")
      .select(
        "id, produk_id, dari_cabang_id, ke_cabang_id, jumlah, catatan, dibuat_pada, status, dibuat_oleh_nama, diterima_oleh_nama, diterima_pada, dibatalkan_oleh_nama, dibatalkan_pada, alasan_pembatalan, bukti_foto_url, catatan_penerimaan",
      )
      .eq("produk_id", produkId)
      .order("dibuat_pada", { ascending: false });

    if (error) {
      setError(error.message);
      setSiap(true);
      return;
    }
    setError(null);
    setData(((baris ?? []) as BarisTransferStok[]).map(keTransferStok));
    setSiap(true);
  }, [produkId]);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  const catat = useCallback(
    async (
      dariCabangId: string,
      keCabangId: string,
      jumlah: number,
      catatan?: string,
    ) => {
      const { error } = await supabase.rpc("catat_transfer_stok", {
        p_produk_id: produkId,
        p_dari_cabang_id: dariCabangId,
        p_ke_cabang_id: keCabangId,
        p_jumlah: jumlah,
        p_catatan: catatan?.trim() ? catatan.trim() : null,
      });

      if (error) {
        // Tidak setError di sini: pesan error ditampilkan langsung di
        // form (lihat TransferStokForm) supaya tidak muncul dobel.
        throw error;
      }

      await muatUlang();
    },
    [produkId, muatUlang],
  );

  // Konfirmasi barang sudah sampai di cabang tujuan: baru di titik ini
  // stok cabang tujuan bertambah (lihat supabase/mutasi_detail.sql &
  // supabase/migrasi_bukti_penerimaan.sql, function
  // konfirmasi_terima_transfer). Sebelum dikonfirmasi, status transfer
  // adalah 'terkirim' dan stok tujuan belum berubah.
  //
  // Foto bukti penerimaan WAJIB (ditegakkan juga di sisi database).
  // Diupload ke bucket "bukti-transfer" dulu, baru URL publiknya
  // dikirim ke function konfirmasi_terima_transfer.
  const konfirmasiTerima = useCallback(
    async (transferId: string, fotoBukti: File, catatanPenerimaan?: string) => {
      const ekstensi = fotoBukti.name.split(".").pop() || "jpg";
      const namaFile = `${transferId}-${Date.now()}.${ekstensi}`;

      const { error: errorUpload } = await supabase.storage
        .from("bukti-transfer")
        .upload(namaFile, fotoBukti, {
          cacheControl: "3600",
          upsert: false,
        });

      if (errorUpload) {
        throw new Error(`Gagal mengunggah foto bukti: ${errorUpload.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("bukti-transfer").getPublicUrl(namaFile);

      const { error } = await supabase.rpc("konfirmasi_terima_transfer", {
        p_transfer_id: transferId,
        p_bukti_foto_url: publicUrl,
        p_catatan_penerimaan: catatanPenerimaan?.trim()
          ? catatanPenerimaan.trim()
          : null,
      });

      if (error) {
        throw error;
      }

      await muatUlang();
    },
    [muatUlang],
  );

  // Batalkan transfer yang masih 'terkirim': mengembalikan jumlah yang
  // sudah dikurangi dari stok cabang asal (lihat
  // supabase/pembatalan_transfer.sql, function batalkan_transfer_stok).
  // Transfer yang sudah 'diterima' atau sudah 'dibatalkan' akan ditolak
  // oleh function di sisi database.
  const batalkan = useCallback(
    async (transferId: string, alasan?: string) => {
      const { error } = await supabase.rpc("batalkan_transfer_stok", {
        p_transfer_id: transferId,
        p_alasan: alasan?.trim() ? alasan.trim() : null,
      });

      if (error) {
        throw error;
      }

      await muatUlang();
    },
    [muatUlang],
  );

  return { data, siap, error, catat, konfirmasiTerima, batalkan, muatUlang };
}

/**
 * Hook untuk halaman "Riwayat Mutasi" per barang: menggabungkan
 * riwayat transaksi stok (masuk/keluar) dan transfer stok (antar
 * cabang) jadi satu linimasa terurut dari yang terbaru, supaya
 * pengguna tidak perlu buka dua halaman terpisah untuk lihat semua
 * pergerakan stok satu barang.
 */
export function useRiwayatMutasi(produkId: string) {
  const transaksi = useTransaksiStok(produkId);
  const transfer = useTransferStok(produkId);
  const cabang = useCabang();

  const data = useMemo<MutasiStok[]>(() => {
    const dariTransaksi: MutasiStok[] = transaksi.data.map((t) => ({
      jenis: t.tipe,
      id: t.id,
      jumlah: t.jumlah,
      catatan: t.catatan,
      dibuatPada: t.dibuatPada,
      cabangId: t.cabangId,
      dibatalkan: t.dibatalkan,
      alasanPembatalan: t.alasanPembatalan,
    }));
    const dariTransfer: MutasiStok[] = transfer.data.map((t) => ({
      jenis: "transfer",
      id: t.id,
      jumlah: t.jumlah,
      catatan: t.catatan,
      dibuatPada: t.dibuatPada,
      dariCabangId: t.dariCabangId,
      keCabangId: t.keCabangId,
      status: t.status,
    }));
    return [...dariTransaksi, ...dariTransfer].sort(
      (a, b) =>
        new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime(),
    );
  }, [transaksi.data, transfer.data]);

  return {
    data,
    daftarCabang: cabang.data,
    siap: transaksi.siap && transfer.siap && cabang.siap,
    error: transaksi.error ?? transfer.error,
  };
}

// Bentuk baris hasil query stok_opname dari Supabase
type BarisStokOpname = {
  id: string;
  produk_id: string;
  cabang_id: string;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  alasan: string | null;
  catatan: string | null;
  transaksi_id: string | null;
  dibuat_oleh_nama: string | null;
  dibuat_pada: string;
  stok_opname_lampiran: { url: string }[] | null;
};

function keStokOpname(baris: BarisStokOpname): StokOpname {
  return {
    id: baris.id,
    produkId: baris.produk_id,
    cabangId: baris.cabang_id,
    stokSistem: baris.stok_sistem,
    stokFisik: baris.stok_fisik,
    selisih: baris.selisih,
    alasan: baris.alasan,
    catatan: baris.catatan,
    transaksiId: baris.transaksi_id,
    dibuatOlehNama: baris.dibuat_oleh_nama,
    dibuatPada: baris.dibuat_pada,
    lampiranUrls: (baris.stok_opname_lampiran ?? []).map((l) => l.url),
  };
}

/**
 * Hook untuk membaca riwayat stok opname (rekonsiliasi fisik) satu
 * produk dan mencatat sesi opname baru lewat Postgres function
 * `catat_stok_opname`. Function di sisi database yang menentukan
 * stok sistem terkini (snapshot), menghitung selisih, dan -- kalau
 * ada selisih -- otomatis membuat baris transaksi_stok penyesuaian
 * (lihat supabase/stok_opname.sql).
 */
export function useStokOpname(produkId: string) {
  const [data, setData] = useState<StokOpname[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    const { data: baris, error } = await supabase
      .from("stok_opname")
      .select(
        "id, produk_id, cabang_id, stok_sistem, stok_fisik, selisih, alasan, catatan, transaksi_id, dibuat_oleh_nama, dibuat_pada, stok_opname_lampiran(url)",
      )
      .eq("produk_id", produkId)
      .order("dibuat_pada", { ascending: false });

    if (error) {
      setError(error.message);
      setSiap(true);
      return;
    }
    setError(null);
    setData(((baris ?? []) as BarisStokOpname[]).map(keStokOpname));
    setSiap(true);
  }, [produkId]);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  // Numpang di bucket "bukti-transaksi" yang sudah ada (lihat
  // supabase/migrasi_bukti_transaksi_stok.sql) -- prefix path
  // "opname/..." supaya tidak campur dengan file bukti transaksi
  // biasa, tanpa perlu bucket & policy storage baru.
  const NAMA_BUCKET_BUKTI = "bukti-transaksi";

  async function uploadLampiranOpname(
    produkId: string,
    files: File[],
  ): Promise<{ url: string; path: string }[]> {
    const hasilUpload: { url: string; path: string }[] = [];
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `opname/${produkId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .upload(path, file);
        if (error) {
          throw new Error(
            `Gagal mengunggah foto (${file.name}): ${error.message}`,
          );
        }
        const { data } = supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .getPublicUrl(path);
        hasilUpload.push({ url: data.publicUrl, path });
      }
      return hasilUpload;
    } catch (err) {
      if (hasilUpload.length > 0) {
        await supabase.storage
          .from(NAMA_BUCKET_BUKTI)
          .remove(hasilUpload.map((f) => f.path))
          .catch(() => {
            // Gagal membersihkan bukan hal fatal -- error asli (upload)
            // yang lebih penting untuk ditampilkan ke user.
          });
      }
      throw err;
    }
  }

  const catat = useCallback(
    async (
      cabangId: string,
      stokFisik: number,
      alasan?: string,
      catatan?: string,
      lampiranFiles?: File[],
    ) => {
      // Foto opsional -- kalau tidak ada file dipilih, langsung
      // panggil RPC tanpa upload apa pun.
      let lampiran: { url: string; path: string }[] = [];
      if (lampiranFiles && lampiranFiles.length > 0) {
        lampiran = await uploadLampiranOpname(produkId, lampiranFiles);
      }

      const { error } = await supabase.rpc("catat_stok_opname", {
        p_produk_id: produkId,
        p_cabang_id: cabangId,
        p_stok_fisik: stokFisik,
        p_alasan: alasan?.trim() ? alasan.trim() : null,
        p_catatan: catatan?.trim() ? catatan.trim() : null,
        p_lampiran_urls: lampiran.length > 0 ? lampiran.map((f) => f.url) : null,
      });

      if (error) {
        // RPC gagal SETELAH foto sudah terunggah -- hapus lagi supaya
        // tidak jadi sampah yatim di bucket tanpa opname yang mengacu
        // ke situ.
        if (lampiran.length > 0) {
          await supabase.storage
            .from(NAMA_BUCKET_BUKTI)
            .remove(lampiran.map((f) => f.path))
            .catch(() => {
              // Gagal membersihkan bukan hal fatal -- error asli (RPC)
              // yang lebih penting untuk dilempar ke pemanggil.
            });
        }
        // Tidak setError di sini: pesan error ditampilkan langsung di
        // form (lihat StokOpnameForm) supaya tidak muncul dobel.
        throw error;
      }

      await muatUlang();
    },
    [produkId, muatUlang],
  );

  return { data, siap, error, catat, muatUlang };
}

// Bentuk baris tabel log_aktivitas_barang dari Supabase
type BarisLogAktivitasBarang = {
  id: string;
  aksi: LogAktivitasBarang["aksi"];
  produk_id: string | null;
  produk_nama: string;
  produk_sku: string;
  cabang_id: string | null;
  cabang_nama: string | null;
  jumlah: number | null;
  keterangan: string | null;
  dilakukan_oleh_nama: string | null;
  dilakukan_pada: string;
};

function keLogAktivitasBarang(
  baris: BarisLogAktivitasBarang,
): LogAktivitasBarang {
  return {
    id: baris.id,
    aksi: baris.aksi,
    produkId: baris.produk_id,
    produkNama: baris.produk_nama,
    produkSku: baris.produk_sku,
    cabangId: baris.cabang_id,
    cabangNama: baris.cabang_nama,
    jumlah: baris.jumlah,
    keterangan: baris.keterangan,
    dilakukanOlehNama: baris.dilakukan_oleh_nama,
    dilakukanPada: baris.dilakukan_pada,
  };
}

/**
 * Hook untuk halaman "Log Aktivitas": jejak audit SIAPA menambahkan
 * barang baru, menghapus barang, atau mengurangi jumlah stok --
 * lintas semua produk (bukan per-produk seperti useTransaksiStok).
 *
 * Data diisi otomatis oleh trigger database (lihat
 * supabase/migrasi_log_aktivitas_barang.sql), bukan ditulis dari
 * sini -- hook ini murni baca. Dibatasi RLS hanya untuk admin ke atas
 * (saya_admin()), sama seperti pembatasan menu di Sidebar.
 */
export function useLogAktivitasBarang(limit = 200) {
  const [data, setData] = useState<LogAktivitasBarang[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    setSiap(false);
    const { data: baris, error } = await supabase
      .from("log_aktivitas_barang")
      .select(
        "id, aksi, produk_id, produk_nama, produk_sku, cabang_id, cabang_nama, jumlah, keterangan, dilakukan_oleh_nama, dilakukan_pada",
      )
      .order("dilakukan_pada", { ascending: false })
      .limit(limit);

    if (error) {
      setError(error.message);
      setSiap(true);
      return;
    }
    setError(null);
    setData(
      ((baris ?? []) as BarisLogAktivitasBarang[]).map(keLogAktivitasBarang),
    );
    setSiap(true);
  }, [limit]);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  return { data, siap, error, muatUlang };
}
