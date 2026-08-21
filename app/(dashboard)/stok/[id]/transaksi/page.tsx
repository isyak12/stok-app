"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCabang, useStok, useTransaksiStok } from "@/lib/storage";
import TransaksiStokForm from "@/components/TransaksiStokForm";
import TransaksiStokTable from "@/components/TransaksiStokTable";

export default function TransaksiStokPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { siap: produkSiap, cariById } = useStok();
  const {
    data: transaksi,
    siap: transaksiSiap,
    error,
    catat,
    batalkan,
  } = useTransaksiStok(params.id);
  const { data: daftarCabang } = useCabang();

  const barang = cariById(params.id);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Inventaris
        </div>
        <h1 className="font-display text-3xl font-semibold">Transaksi Stok</h1>
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

          <TransaksiStokForm
            cabangDefaultId={barang.cabangId}
            onCatat={catat}
          />

          <div>
            <h2 className="font-display text-lg font-semibold mb-3">
              Riwayat Transaksi
            </h2>
            <p className="text-xs text-ink/50 mb-3 max-w-xl">
              Salah input jumlah atau tipe transaksi? Klik "Batalkan" pada
              baris terkait — efeknya ke stok akan dikoreksi balik dan
              tercatat siapa yang membatalkan. Transaksi yang sudah
              dibatalkan tetap tersimpan di riwayat (bukan dihapus) supaya
              jejaknya tetap jelas.
            </p>
            {error && (
              <div className="mb-3 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
                Gagal memuat riwayat transaksi: {error}
              </div>
            )}
            {!transaksiSiap ? (
              <p className="text-ink/40 text-sm">Memuat riwayat...</p>
            ) : (
              <TransaksiStokTable
                data={transaksi}
                daftarCabang={daftarCabang}
                onBatalkan={batalkan}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
