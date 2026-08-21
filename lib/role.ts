import { User } from "@supabase/supabase-js";

export type Peran = "admin" | "staf";

/**
 * Baca peran dari user metadata Supabase Auth. Default "staf" kalau
 * field "peran" belum pernah di-set lewat dashboard -- supaya akun
 * baru yang belum dikonfigurasi otomatis dapat akses paling minim,
 * bukan malah kebuka penuh.
 */
export function peranDariUser(user: User | null | undefined): Peran {
  const nilai = user?.user_metadata?.peran;
  return nilai === "admin" ? "admin" : "staf";
}

export function labelPeran(peran: Peran): string {
  return peran === "admin" ? "Admin" : "Staf Gudang";
}
