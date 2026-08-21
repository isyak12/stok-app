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
};

export type BarangInput = Omit<Barang, "id" | "diperbaruiPada" | "stokRendah">;

export type TipeTransaksi = "masuk" | "keluar";

export type TransaksiStok = {
  id: string;
  produkId: string;
  cabangId: string;
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
  dibuatPada: string; // ISO date string
};

export type Cabang = {
  id: string;
  nama: string;
  kode: string;
};

export type TransferStok = {
  id: string;
  produkId: string;
  dariCabangId: string;
  keCabangId: string;
  jumlah: number;
  catatan: string | null;
  dibuatPada: string; // ISO date string
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
    }
  | {
      jenis: "transfer";
      id: string;
      jumlah: number;
      catatan: string | null;
      dibuatPada: string;
      dariCabangId: string;
      keCabangId: string;
    };
