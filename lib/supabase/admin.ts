import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Klien Supabase dengan SERVICE ROLE KEY -- bypass RLS sepenuhnya dan
 * bisa memanggil Auth Admin API (buat/hapus/ubah akun user).
 *
 * WAJIB HANYA dipanggil dari kode server (route handler API, mis.
 * app/api/pengguna/route.ts). Paket "server-only" di atas akan
 * membuat build GAGAL kalau file ini ter-import ke bundle client
 * secara tidak sengaja -- lapisan pengaman tambahan supaya kunci
 * service role tidak pernah bocor ke browser.
 *
 * Client biasa (lib/supabase/client.ts) sengaja TIDAK dipakai untuk
 * operasi ini karena hanya membawa anon key + sesi user yang login,
 * yang tidak punya akses ke Auth Admin API.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur. " +
        "Lihat .env.local.example untuk cara mengambil service role key.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
