"use client";

import Link from "next/link";
import { ArrowLeftRight, ArrowRightLeft, ClipboardCheck, History } from "lucide-react";
import { useStok } from "@/lib/storage";
import StokForm from "@/components/StokForm";
import { useParams, useRouter } from "next/navigation";

export default function EditStokPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { siap, cariById, perbarui } = useStok();

  const barang = cariById(params.id);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
            Inventaris
          </div>
          <h1 className="font-display text-3xl font-semibold">Ubah Barang</h1>
        </div>
        {barang && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/stok/${barang.id}/transaksi`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-ink/15 text-sm rounded-sm hover:bg-white transition-colors whitespace-nowrap"
            >
              <ArrowLeftRight size={15} />
              Transaksi Stok
            </Link>
            <Link
              href={`/stok/${barang.id}/transfer`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-ink/15 text-sm rounded-sm hover:bg-white transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft size={15} />
              Transfer Stok
            </Link>
            <Link
              href={`/stok/${barang.id}/opname`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-ink/15 text-sm rounded-sm hover:bg-white transition-colors whitespace-nowrap"
            >
              <ClipboardCheck size={15} />
              Stok Opname
            </Link>
            <Link
              href={`/stok/${barang.id}/riwayat`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-ink/15 text-sm rounded-sm hover:bg-white transition-colors whitespace-nowrap"
            >
              <History size={15} />
              Riwayat Mutasi
            </Link>
          </div>
        )}
      </div>

      {!siap ? (
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
        <StokForm
          judul={`Ubah "${barang.nama}"`}
          awal={barang}
          onSimpan={(input) => perbarui(barang.id, input)}
        />
      )}
    </div>
  );
}
