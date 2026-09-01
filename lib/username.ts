// Supabase Auth berbasis email. Supaya user bisa login pakai
// "username" biasa (tanpa email sungguhan), kita ubah username
// jadi email internal palsu dengan domain ini di baliknya.
// Domain ini TIDAK perlu benar-benar ada / aktif menerima email.
const DOMAIN_INTERNAL = "stokku.local";

/**
 * Ubah username (mis. "superadmin") menjadi email internal
 * (mis. "superadmin@stokku.local") yang dipakai Supabase Auth.
 *
 * PENTING (bugfix): sebelumnya fungsi ini hanya trim + lowercase +
 * hapus spasi, tanpa memfilter karakter "@" -- kalau username yang
 * dimasukkan mengandung "@" (mis. "staf@gudang"), hasilnya jadi email
 * dengan DUA "@" ("staf@gudang@stokku.local"), yang bisa ditolak
 * Supabase Auth atau membuat parsing username↔email di
 * emailKeUsername() tidak sesuai ekspektasi (hanya mengambil bagian
 * sebelum "@" PERTAMA). Karakter "@" sekarang dibuang supaya
 * username selalu menghasilkan email internal yang valid dan bisa
 * dibalik dengan benar oleh emailKeUsername(). Validasi utama tetap
 * ada di app/api/pengguna/route.ts (menolak karakter tidak valid
 * SEBELUM akun dibuat) -- pembersihan di sini murni lapisan
 * pertahanan tambahan.
 */
export function usernameKeEmail(username: string): string {
  const bersih = username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/@/g, "");
  return `${bersih}@${DOMAIN_INTERNAL}`;
}

/**
 * Validasi karakter yang diizinkan untuk username: huruf, angka,
 * titik, garis bawah, dan strip. Dipakai di app/api/pengguna/route.ts
 * SEBELUM akun dibuat, supaya username yang mengandung karakter aneh
 * ("@", spasi di tengah, dsb.) ditolak lebih awal dengan pesan yang
 * jelas -- bukan diam-diam "dibersihkan" oleh usernameKeEmail() dan
 * berakhir jadi username yang beda dari yang diketik admin.
 */
export function usernameValid(username: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(username);
}

/**
 * Ubah email internal (mis. "superadmin@stokku.local") kembali
 * jadi username untuk ditampilkan (mis. "superadmin").
 */
export function emailKeUsername(email: string): string {
  return email.split("@")[0];
}
