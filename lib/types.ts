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
  diperbaruiPada: string; // ISO date string
};

export type BarangInput = Omit<Barang, "id" | "diperbaruiPada">;

export type TipeTransaksi = "masuk" | "keluar";

export type TransaksiStok = {
  id: string;
  produkId: string;
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
  dibuatPada: string; // ISO date string
};
