import { User } from "@supabase/supabase-js";

export type Peran = "admin" | "staf";

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
  return nilai === "admin" ? "admin" : "staf";
}

export function labelPeran(peran: Peran): string {
  return peran === "admin" ? "Admin" : "Staf Gudang";
}