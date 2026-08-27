"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JenisMutasi, MutasiStok } from "@/lib/types-mutasi";

const BUCKET = "lampiran-mutasi";

interface BuatMutasiInput {
  produk_id: string;
  jenis: JenisMutasi;
  jumlah: number;
  keterangan?: string;
  tanggal?: string; // default hari ini kalau kosong
  files?: File[];   // lampiran, opsional & bisa lebih dari satu
}

export function useMutasiStok() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buatMutasi(input: BuatMutasiInput): Promise<MutasiStok | null> {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // 1. Insert baris mutasi (trigger di DB otomatis update jumlah di tabel stok)
      const { data: mutasi, error: mutasiError } = await supabase
        .from("mutasi_stok")
        .insert({
          produk_id: input.produk_id,
          jenis: input.jenis,
          jumlah: input.jumlah,
          keterangan: input.keterangan ?? null,
          tanggal: input.tanggal ?? new Date().toISOString().slice(0, 10),
          dibuat_oleh: userData.user?.id ?? null,
        })
        .select()
        .single();

      if (mutasiError) throw mutasiError;

      // 2. Upload lampiran (kalau ada) ke Supabase Storage + catat di mutasi_lampiran
      if (input.files && input.files.length > 0) {
        for (const file of input.files) {
          const path = `${mutasi.id}/${Date.now()}-${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file);
          if (uploadError) throw uploadError;

          const { error: lampiranError } = await supabase
            .from("mutasi_lampiran")
            .insert({
              mutasi_id: mutasi.id,
              file_path: path,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
            });
          if (lampiranError) throw lampiranError;
        }
      }

      return mutasi as MutasiStok;
    } catch (err: any) {
      setError(err.message ?? "Gagal menyimpan mutasi stok");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Ambil URL sementara (signed URL) untuk menampilkan/download lampiran
  async function getLampiranUrl(path: string, expiresInDetik = 3600) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInDetik);
    if (error) {
      setError(error.message);
      return null;
    }
    return data.signedUrl;
  }

  async function getRiwayatMutasi(produkId: string) {
    const { data, error } = await supabase
      .from("mutasi_stok")
      .select("*, mutasi_lampiran(*)")
      .eq("produk_id", produkId)
      .order("tanggal", { ascending: false });
    if (error) {
      setError(error.message);
      return [];
    }
    return data;
  }

  return { buatMutasi, getLampiranUrl, getRiwayatMutasi, loading, error };
}
