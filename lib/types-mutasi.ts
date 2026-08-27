// Tambahkan / gabungkan tipe berikut ke lib/types.ts yang sudah ada

export type JenisMutasi = "masuk" | "keluar";

export interface MutasiLampiran {
  id: string;
  mutasi_id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

export interface MutasiStok {
  id: string;
  produk_id: string;
  jenis: JenisMutasi;
  jumlah: number;
  keterangan: string | null;
  tanggal: string;
  dibuat_oleh: string | null;
  created_at: string;
  lampiran?: MutasiLampiran[]; // hasil join, opsional
}
