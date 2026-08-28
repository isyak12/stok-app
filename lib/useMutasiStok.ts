"use client";

// ============================================================
// Hook useMutasiStok()
// Taruh file ini di lib/useMutasiStok.ts, atau gabungkan isinya
// ke lib/storage.ts di sebelah hook useStok() yang sudah ada.
// Mengikuti pola yang sama: baca/tulis langsung ke Supabase.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MutasiStokDenganProduk, TambahMutasiInput } from "@/lib/types";

export function useMutasiStok(produkId?: string) {
  const supabase = createClient();
  const [data, setData] = useState<MutasiStokDenganProduk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("mutasi_stok")
      .select("*, produk:produk_id ( nama, sku, satuan )")
      .order("created_at", { ascending: false });

    if (produkId) {
      query = query.eq("produk_id", produkId);
    }

    const { data: hasil, error: err } = await query;

    if (err) {
      setError(err.message);
    } else {
      setData((hasil ?? []) as unknown as MutasiStokDenganProduk[]);
    }
    setLoading(false);
  }, [supabase, produkId]);

  useEffect(() => {
    muat();
  }, [muat]);

  const tambahMutasi = useCallback(
    async (input: TambahMutasiInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: err } = await supabase.from("mutasi_stok").insert({
        produk_id: input.produk_id,
        jenis: input.jenis,
        jumlah: input.jumlah,
        keterangan: input.keterangan,
        dibuat_oleh: user?.id ?? null,
      });

      if (err) {
        // Pesan dari trigger Postgres (mis. "Stok tidak mencukupi...")
        // akan muncul di err.message, tampilkan langsung ke user.
        throw new Error(err.message);
      }

      await muat();
    },
    [supabase, muat]
  );

  return { data, loading, error, muat, tambahMutasi };
}
