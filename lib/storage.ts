"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import {
  Barang,
  BarangInput,
  Cabang,
  TipeTransaksi,
  TransaksiStok,
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
  const semuaStok = baris.stok ?? [];
  const totalJumlah = semuaStok.reduce((sum, s) => sum + s.jumlah, 0);
  const stokUtama = semuaStok[0]; // dipakai untuk stokMinimum, lokasi, cabangId default
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

      const { data: stokTerupdate, error: errStok } = await supabase
        .from("stok")
        .update({
          jumlah: input.jumlah,
          stok_minimum: input.stokMinimum,
          lokasi: input.lokasi,
        })
        .eq("produk_id", id)
        .select("id");

      if (errStok) {
        setError(errStok.message);
        throw errStok;
      }
      if (!stokTerupdate || stokTerupdate.length === 0) {
        // Baris stok belum ada untuk produk ini (mis. data lama/tidak konsisten) — buat baru.
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

// Bentuk baris tabel transaksi_stok dari Supabase
type BarisTransaksiStok = {
  id: string;
  produk_id: string;
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
  dibuat_pada: string;
};

function keTransaksiStok(baris: BarisTransaksiStok): TransaksiStok {
  return {
    id: baris.id,
    produkId: baris.produk_id,
    tipe: baris.tipe,
    jumlah: baris.jumlah,
    catatan: baris.catatan,
    dibuatPada: baris.dibuat_pada,
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
      .select("id, produk_id, tipe, jumlah, catatan, dibuat_pada")
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
    ) => {
      const { error } = await supabase.rpc("catat_transaksi_stok", {
        p_produk_id: produkId,
        p_cabang_id: cabangId,
        p_tipe: tipe,
        p_jumlah: jumlah,
        p_catatan: catatan?.trim() ? catatan.trim() : null,
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
