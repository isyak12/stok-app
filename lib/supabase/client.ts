import { createBrowserClient } from "@supabase/ssr";

/**
 * Klien Supabase untuk dipakai di client component ("use client").
 * Sesi login disimpan lewat cookie, sehingga bisa dibaca juga oleh
 * middleware dan server component.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur. " +
        "Salin .env.local.example menjadi .env.local dan isi kredensial project Supabase Anda."
    );
  }

  return createBrowserClient(url, anonKey);
}
