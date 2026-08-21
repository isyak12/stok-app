"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { emailKeUsername } from "./username";
import {
  Barang,
  BarangInput,
  Cabang,
  MutasiStok,
  StokCabangValues,
  TipeTransaksi,
  TransaksiStok,
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
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
  dibuat_pada: string;
  dibuat_oleh_nama: string | null;
  pihak: string | null;
  no_referensi: string | null;
};

function keTransaksiStok(baris: BarisTransaksiStok): TransaksiStok {
  return {
    id: baris.id,
    produkId: baris.produk_id,
    tipe: baris.tipe,
    jumlah: baris.jumlah,
    catatan: baris.catatan,
    dibuatPada: baris.dibuat_pada,
    dibuatOlehNama: baris.dibuat_oleh_nama
      ? emailKeUsername(baris.dibuat_oleh_nama)
      : null,
    pihak: baris.pihak,
    noReferensi: baris.no_referensi,
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
        "id, produk_id, tipe, jumlah, catatan, dibuat_pada, dibuat_oleh_nama, pihak, no_referensi",
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

  const catat = useCallback(
    async (
      tipe: TipeTransaksi,
      jumlah: number,
      cabangId: string,
      catatan?: string,
      pihak?: string,
      noReferensi?: string,
    ) => {
      const { error } = await supabase.rpc("catat_transaksi_stok", {
        p_produk_id: produkId,
        p_cabang_id: cabangId,
        p_tipe: tipe,
        p_jumlah: jumlah,
        p_catatan: catatan?.trim() ? catatan.trim() : null,
        p_pihak: pihak?.trim() ? pihak.trim() : null,
        p_no_referensi: noReferensi?.trim() ? noReferensi.trim() : null,
      });

      if (error) {
        // Tidak setError di sini: pesan error ditampilkan langsung di
        // form (lihat TransaksiStokForm) supaya tidak muncul dobel.
        throw error;
      }

      await muatUlang();
    },
    [produkId, muatUlang],
  );

  return { data, siap, error, catat, muatUlang };
}

/**
 * Hook untuk mengambil daftar cabang (dipakai di dropdown form).
 */
export function useCabang() {
  const [data, setData] = useState<Cabang[]>([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    supabase
      .from("cabang")
      .select("id, nama, kode")
      .order("nama", { ascending: true })
      .then(({ data }) => {
        setData(data ?? []);
        setSiap(true);
      });
  }, []);

  return { data, siap };
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
  status: "terkirim" | "diterima";
  dibuat_oleh_nama: string | null;
  diterima_oleh_nama: string | null;
  diterima_pada: string | null;
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
    dibuatOlehNama: baris.dibuat_oleh_nama
      ? emailKeUsername(baris.dibuat_oleh_nama)
      : null,
    diterimaOlehNama: baris.diterima_oleh_nama
      ? emailKeUsername(baris.diterima_oleh_nama)
      : null,
    diterimaPada: baris.diterima_pada,
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
        "id, produk_id, dari_cabang_id, ke_cabang_id, jumlah, catatan, dibuat_pada, status, dibuat_oleh_nama, diterima_oleh_nama, diterima_pada",
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

  // Konfirmasi barang sudah sampai di cabang tujuan -- baru di titik
  // ini stok cabang tujuan bertambah (lihat catatan di
  // supabase/mutasi_detail.sql untuk alasan alur "terkirim -> diterima").
  const konfirmasiTerima = useCallback(
    async (transferId: string) => {
      const { error } = await supabase.rpc("konfirmasi_terima_transfer", {
        p_transfer_id: transferId,
      });

      if (error) {
        throw error;
      }

      await muatUlang();
    },
    [muatUlang],
  );

  return { data, siap, error, catat, konfirmasiTerima, muatUlang };
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
      dibuatOlehNama: t.dibuatOlehNama,
      pihak: t.pihak,
      noReferensi: t.noReferensi,
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
      dibuatOlehNama: t.dibuatOlehNama,
      diterimaOlehNama: t.diterimaOlehNama,
      diterimaPada: t.diterimaPada,
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
