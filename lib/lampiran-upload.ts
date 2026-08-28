import { createClient } from "./supabase/client";

const supabase = createClient();

// Upload beberapa file ke satu bucket Storage Supabase, dengan
// rollback otomatis kalau salah satu file gagal di tengah jalan
// (file-file sebelumnya yang sudah kadung terunggah dihapus lagi,
// supaya tidak jadi sampah tak terpakai di bucket).
//
// Sebelumnya logic ini di-copy-paste identik sebagai
// `uploadLampiran` (untuk transaksi stok) dan `uploadLampiranOpname`
// (untuk stok opname) di lib/storage.ts -- disatukan di sini supaya
// tidak dobel maintain kalau ada perbaikan bug di logic upload/
// rollback-nya.
export async function uploadLampiranKeBucket(
  namaBucket: string,
  pathPrefix: string,
  files: File[],
  labelUntukError: string = "lampiran",
): Promise<{ url: string; path: string }[]> {
  const hasilUpload: { url: string; path: string }[] = [];
  try {
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from(namaBucket)
        .upload(path, file);
      if (error) {
        throw new Error(
          `Gagal mengunggah ${labelUntukError} (${file.name}): ${error.message}`,
        );
      }
      const { data } = supabase.storage.from(namaBucket).getPublicUrl(path);
      hasilUpload.push({ url: data.publicUrl, path });
    }
    return hasilUpload;
  } catch (err) {
    if (hasilUpload.length > 0) {
      await supabase.storage
        .from(namaBucket)
        .remove(hasilUpload.map((f) => f.path))
        .catch(() => {
          // Gagal membersihkan bukan hal fatal -- error asli (upload)
          // yang lebih penting untuk ditampilkan ke user.
        });
    }
    throw err;
  }
}
