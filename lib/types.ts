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
