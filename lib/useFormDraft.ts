"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DraftTersimpan<T> = { data: T; savedAt: number };

/**
 * Auto-save draft form ke localStorage supaya isian panjang tidak hilang
 * kalau koneksi putus, tab tertutup tidak sengaja, atau tombol back kepencet.
 *
 * Cara pakai:
 *   const { draftDitemukan, draft, pulihkan, bersihkan, lastSavedAt } =
 *     useFormDraft("draft-transaksi-masuk-" + produkId, { jumlah, catatan, ... });
 *
 * - Setiap `data` berubah, draft otomatis disimpan (debounced) ke localStorage.
 * - Saat komponen pertama kali mount, hook cek apakah ada draft lama tersisa;
 *   kalau ada, `draftDitemukan` jadi true supaya UI bisa tanya "pulihkan?".
 * - Panggil `bersihkan()` setelah submit berhasil supaya draft tidak nyangkut.
 * - File/Blob TIDAK ikut tersimpan (localStorage cuma bisa simpan JSON) --
 *   jangan masukkan field File ke `data`, cukup metadata teks/angka.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  data: T,
  options?: {
    /** Jeda sebelum draft ditulis ulang setelah user berhenti mengetik (ms). */
    debounceMs?: number;
    /** Anggap draft "kosong" (tidak perlu disimpan/ditawarkan) kalau semua field ini falsy. */
    isEmpty?: (data: T) => boolean;
  },
) {
  const debounceMs = options?.debounceMs ?? 600;
  const isEmpty =
    options?.isEmpty ??
    ((d: T) => Object.values(d).every((v) => v === "" || v === 0 || !v));

  const [draftDitemukan, setDraftDitemukan] = useState(false);
  const [draft, setDraft] = useState<DraftTersimpan<T> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sudahCekAwal = useRef(false);

  // Sekali saat mount: cek apakah ada draft lama tersimpan di browser ini.
  useEffect(() => {
    if (sudahCekAwal.current) return;
    sudahCekAwal.current = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftTersimpan<T>;
        if (parsed?.data && !isEmpty(parsed.data)) {
          setDraft(parsed);
          setDraftDitemukan(true);
        }
      }
    } catch {
      // localStorage tidak tersedia (mode privat dsb.) atau datanya korup --
      // abaikan saja, fitur draft cuma "nice to have", bukan hal wajib.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Setiap `data` berubah, tulis ulang draft ke localStorage (debounced)
  // supaya tidak nulis di setiap ketikan huruf.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        if (isEmpty(data)) {
          window.localStorage.removeItem(key);
          setLastSavedAt(null);
        } else {
          const savedAt = Date.now();
          window.localStorage.setItem(
            key,
            JSON.stringify({ data, savedAt } satisfies DraftTersimpan<T>),
          );
          setLastSavedAt(savedAt);
        }
      } catch {
        // Storage penuh / diblokir -- gagal diam-diam, jangan ganggu user.
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, JSON.stringify(data), debounceMs]);

  const bersihkan = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // abaikan
    }
    setDraft(null);
    setDraftDitemukan(false);
    setLastSavedAt(null);
  }, [key]);

  const abaikanTawaran = useCallback(() => {
    setDraftDitemukan(false);
  }, []);

  return { draft, draftDitemukan, bersihkan, abaikanTawaran, lastSavedAt };
}
