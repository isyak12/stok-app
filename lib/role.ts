import { User } from "@supabase/supabase-js";

// "superadmin" ditambahkan di atas "admin": bisa melakukan semua hal
// yang admin biasa bisa (lihat saya_admin() di
// supabase/migrasi_superadmin.sql -- superadmin dihitung sebagai admin
// di semua RLS policy & trigger yang sudah ada), DITAMBAH kewenangan
// khusus mengelola akun pengguna (bikin user baru & menentukan
// perannya). Sengaja dipisah dari "admin" biasa supaya admin biasa
// tidak otomatis bisa membuat akun admin lain.
export type Peran = "superadmin" | "admin" | "staf";

/**
 * Baca peran dari app_metadata Supabase Auth (BUKAN user_metadata).
 *
 * PENTING: app_metadata sengaja dipakai di sini karena field itu HANYA
 * bisa diubah lewat Admin API / SQL Editor (service role) -- user yang
 * login TIDAK BISA mengubahnya sendiri lewat client SDK
 * (supabase.auth.updateUser() cuma bisa menulis ke user_metadata).
 * Kalau peran dibaca dari user_metadata, staf biasa bisa naik jadi
 * admin sendiri lewat console browser (updateUser({ data: { peran:
 * "admin" } })) -- ini yang dulu jadi celah privilege escalation.
 *
 * Default "staf" kalau field "peran" belum pernah di-set -- supaya
 * akun baru yang belum dikonfigurasi otomatis dapat akses paling
 * minim, bukan malah kebuka penuh.
 */
export function peranDariUser(user: User | null | undefined): Peran {
  const nilai = user?.app_metadata?.peran;
  if (nilai === "superadmin") return "superadmin";
  if (nilai === "admin") return "admin";
  return "staf";
}

export function labelPeran(peran: Peran): string {
  if (peran === "superadmin") return "Superadmin";
  if (peran === "admin") return "Admin";
  return "Staf Gudang";
}

/**
 * true untuk "admin" ATAU "superadmin". Dipakai di UI untuk fitur yang
 * selama ini dibatasi ke admin (mis. tambah/hapus barang) -- superadmin
 * otomatis mewarisi semuanya. Cocok dengan saya_admin() di sisi
 * database (supabase/migrasi_superadmin.sql).
 */
export function adalahAdminAtauLebih(peran: Peran): boolean {
  return peran === "admin" || peran === "superadmin";
}