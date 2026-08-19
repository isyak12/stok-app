// Supabase Auth berbasis email. Supaya user bisa login pakai
// "username" biasa (tanpa email sungguhan), kita ubah username
// jadi email internal palsu dengan domain ini di baliknya.
// Domain ini TIDAK perlu benar-benar ada / aktif menerima email.
const DOMAIN_INTERNAL = "stokku.local";

/**
 * Ubah username (mis. "superadmin") menjadi email internal
 * (mis. "superadmin@stokku.local") yang dipakai Supabase Auth.
 */
export function usernameKeEmail(username: string): string {
  const bersih = username.trim().toLowerCase().replace(/\s+/g, "");
  return `${bersih}@${DOMAIN_INTERNAL}`;
}

/**
 * Ubah email internal (mis. "superadmin@stokku.local") kembali
 * jadi username untuk ditampilkan (mis. "superadmin").
 */
export function emailKeUsername(email: string): string {
  return email.split("@")[0];
}
