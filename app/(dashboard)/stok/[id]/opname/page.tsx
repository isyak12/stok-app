"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCabang, useStok, useStokOpname } from "@/lib/storage";
import StokOpnameForm from "@/components/StokOpnameForm";
import StokOpnameTable from "@/components/StokOpnameTable";

export default function StokOpnamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { siap: produkSiap, cariById } = useStok();
  const { data: daftarCabang } = useCabang();
  const {
    data: opname,
    siap: opnameSiap,
    error,
    catat,
  } = useStokOpname(params.id);

  const barang = cariById(params.id);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Inventaris
        </div>
        <h1 className="font-display text-3xl font-semibold">Stok Opname</h1>
        {barang && (
          <p className="text-sm text-ink/60 mt-1">
            {barang.nama} · Stok saat ini (semua cabang): {barang.jumlah}{" "}
            {barang.satuan}
          </p>
        )}
      </div>

      {!produkSiap ? (
        <p className="text-ink/40 text-sm">Memuat data...</p>
      ) : !barang ? (
        <div className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl">
          <p className="text-sm text-ink/60">
            Barang tidak ditemukan. Mungkin sudah dihapus.
          </p>
          <button
            onClick={() => router.push("/stok")}
            className="mt-4 px-4 py-2 border border-ink/15 text-sm rounded-sm hover:bg-paper"
          >
            Kembali ke daftar stok
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <Link
            href={`/stok/${barang.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
          >
            <ArrowLeft size={14} />
            Kembali ke "{barang.nama}"
          </Link>

          <p className="text-xs text-ink/50 max-w-xl">
            Hitung fisik barang di gudang, lalu masukkan hasilnya di sini.
            Kalau cocok dengan stok sistem, cukup tercatat sebagai bukti
            "sudah dicek". Kalau ada selisih, sistem otomatis mencatat
            transaksi penyesuaian (masuk/keluar) sesuai alasan yang dipilih —
            stok cabang terkait langsung disesuaikan ke angka hasil hitung
            fisik.
          </p>

          <StokOpnameForm barang={barang} onCatat={catat} />

          <div>
            <h2 className="font-display text-lg font-semibold mb-3">
              Riwayat Opname
            </h2>
            {error && (
              <div className="mb-3 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
                Gagal memuat riwayat opname: {error}
              </div>
            )}
            {!opnameSiap ? (
              <p className="text-ink/40 text-sm">Memuat riwayat...</p>
            ) : (
              <StokOpnameTable data={opname} daftarCabang={daftarCabang} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
