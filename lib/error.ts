/**
 * Ambil pesan error yang aman ditampilkan ke user dari nilai apa pun
 * yang bisa "dilempar" (thrown) di JS/TS -- bukan cuma instance
 * `Error` bawaan.
 *
 * PENTING: error dari Supabase (`const { error } = await supabase...`)
 * BUKAN instance `Error` bawaan JS kecuali secara eksplisit memakai
 * `.throwOnError()`. Di kode ini kita selalu memakai pola
 * `if (error) throw error;`, dan `error` itu berbentuk objek biasa
 * `{ message, code, details, hint }` (lihat @supabase/postgrest-js,
 * PostgrestBuilder.processResponse -- `error = JSON.parse(body)`,
 * bukan `new PostgrestError(...)`).
 *
 * Kalau cuma dicek `err instanceof Error`, cek itu SELALU false untuk
 * error Supabase -- akibatnya pesan asli dari database (mis. "Stok
 * tidak cukup", "Data stok di cabang ini tidak ditemukan") selalu
 * dibuang begitu saja dan diganti pesan generik yang tidak membantu
 * user tahu apa yang sebenarnya salah.
 *
 * Fungsi ini menangani ketiganya: instance `Error`, objek biasa yang
 * punya field `message` bertipe string (termasuk error Supabase), dan
 * fallback ke `pesanDefault` untuk bentuk lain yang tidak dikenali.
 */
export function pesanError(err: unknown, pesanDefault: string): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message.trim() !== ""
  ) {
    return (err as { message: string }).message;
  }
  return pesanDefault;
}
