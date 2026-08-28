export type Barang = {
  id: string;
  sku: string;
  nama: string;
  kategori: string;
  jumlah: number;
  satuan: string;
  stokMinimum: number;
  hargaBeli: number;
  hargaJual: number;
  lokasi: string;
  cabangId: string;
  diperbaruiPada: string; // ISO date string
  // true kalau ADA MINIMAL SATU cabang yang stoknya <= stok minimum
  // cabang itu sendiri. Dihitung per-baris-stok (bukan dari jumlah
  // gabungan semua cabang), supaya tidak salah tampil "aman" saat
  // total gabungan masih besar tapi satu cabang sudah kritis.
  stokRendah: boolean;
  // Rincian stok per cabang (bukan gabungan) — dipakai untuk
  // menunjukkan CABANG MANA yang stoknya kritis, bukan cuma angka
  // total gabungan yang bisa membingungkan saat produk tersebar
  // di banyak cabang.
  stokPerCabang: {
    cabangId: string;
    jumlah: number;
    stokMinimum: number;
    rendah: boolean;
  }[];
};

export type BarangInput = Omit<
  Barang,
  "id" | "diperbaruiPada" | "stokRendah" | "stokPerCabang"
>;

export type TipeTransaksi = "masuk" | "keluar";

export type TransaksiStok = {
  id: string;
  produkId: string;
  cabangId: string;
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
  dibuatPada: string;
  dibuatOlehNama: string | null;
  pihak: string | null;
  noReferensi: string | null;
  dibatalkan: boolean;
  dibatalkanOlehNama: string | null;
  dibatalkanPada: string | null;
  alasanPembatalan: string | null;
  // URL publik bukti (foto/dokumen) transaksi -- wajib diisi minimal
  // 1 file saat mencatat transaksi (lihat
  // supabase/migrasi_bukti_transaksi_stok.sql). Transaksi lama
  // (sebelum migrasi ini) akan punya array kosong.
  lampiranUrls: string[];
};

export type Cabang = {
  id: string;
  nama: string;
  kode: string;
};

// Alasan penyesuaian stok opname. Bebas teks di database (supaya
// tidak kaku), tapi UI membatasi ke kategori umum ini + "lainnya"
// dengan catatan bebas.
export type AlasanOpname = "rusak" | "hilang" | "salah_catat" | "lainnya";

export type StokOpname = {
  id: string;
  produkId: string;
  cabangId: string;
  stokSistem: number; // snapshot stok sistem saat opname dilakukan
  stokFisik: number; // hasil hitung manual staf
  selisih: number; // stokFisik - stokSistem
  alasan: string | null; // null kalau selisih = 0 (tidak ada yang perlu dijelaskan)
  catatan: string | null;
  transaksiId: string | null; // null kalau selisih = 0 (tidak ada penyesuaian)
  dibuatOlehNama: string | null;
  dibuatPada: string; // ISO date string
};

// Satu baris jejak audit dari tabel log_aktivitas_barang (lihat
// supabase/migrasi_log_aktivitas_barang.sql). Diisi otomatis lewat
// trigger database -- BUKAN ditulis manual dari kode aplikasi --
// supaya tidak ada jalur perubahan produk/stok yang lolos tidak
// tercatat.
export type AksiLogBarang = "tambah" | "hapus" | "kurangi";

export type LogAktivitasBarang = {
  id: string;
  aksi: AksiLogBarang;
  produkId: string | null;
  produkNama: string;
  produkSku: string;
  cabangId: string | null;
  cabangNama: string | null;
  jumlah: number | null;
  keterangan: string | null;
  dilakukanOlehNama: string | null;
  dilakukanPada: string; // ISO date string
};

export type StatusTransfer = "terkirim" | "diterima" | "dibatalkan";

export type TransferStok = {
  id: string;
  produkId: string;
  dariCabangId: string;
  keCabangId: string;
  jumlah: number;
  catatan: string | null;
  dibuatPada: string; // ISO date string
  status: StatusTransfer;
  dibuatOlehNama: string | null;
  diterimaOlehNama: string | null;
  diterimaPada: string | null; // ISO date string, null kalau belum dikonfirmasi
  dibatalkanOlehNama: string | null;
  dibatalkanPada: string | null; // ISO date string, null kalau tidak dibatalkan
  alasanPembatalan: string | null;
  // Bukti foto penerimaan barang — wajib diisi saat konfirmasi terima
  // (lihat supabase/migrasi_bukti_penerimaan.sql). Null untuk transfer
  // lama yang dikonfirmasi sebelum fitur ini ada.
  buktiFotoUrl: string | null;
  // Catatan dari staf cabang tujuan saat konfirmasi terima — terpisah
  // dari `catatan` yang diisi staf cabang asal saat mengirim, karena
  // kondisi barang saat sampai bisa beda dari yang tercatat saat kirim.
  catatanPenerimaan: string | null;
};

// Nilai stok yang spesifik untuk satu kombinasi produk + cabang.
// Dipakai form edit saat pengguna berpindah pilihan cabang.
export type StokCabangValues = {
  jumlah: number;
  stokMinimum: number;
  lokasi: string;
};

// Satu baris riwayat mutasi stok gabungan (dipakai halaman
// "Riwayat Mutasi" per barang). Menyatukan dua sumber data yang
// aslinya terpisah — transaksi_stok (masuk/keluar) dan transfer_stok
// (antar cabang) — supaya bisa ditampilkan sebagai satu linimasa
// terurut berdasarkan tanggal.
export type MutasiStok =
  | {
      jenis: "masuk" | "keluar";
      id: string;
      jumlah: number;
      catatan: string | null;
      dibuatPada: string;
      cabangId: string;
      // Ditandai true kalau transaksi ini sudah dibatalkan (lihat
      // supabase/pembatalan_transaksi.sql). Baris tetap ditampilkan
      // di riwayat (bukan dihapus) supaya jejak audit tetap utuh,
      // tapi UI menandainya secara visual sebagai tidak berlaku lagi.
      dibatalkan: boolean;
      alasanPembatalan: string | null;
    }
  | {
      jenis: "transfer";
      id: string;
      jumlah: number;
      catatan: string | null;
      dibuatPada: string;
      dariCabangId: string;
      keCabangId: string;
      // Status alur kirim -> terima. Dipakai supaya "Riwayat Mutasi"
      // tidak menampilkan transfer yang stok tujuannya BELUM
      // bertambah seolah-olah sudah pindah sepenuhnya.
      status: StatusTransfer;
    };
