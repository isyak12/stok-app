"use client";

import { useStok } from "@/lib/storage";
import StokForm from "@/components/StokForm";
import { useParams, useRouter } from "next/navigation";

export default function EditStokPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { siap, cariById, perbarui } = useStok();

  const barang = cariById(params.id);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Inventaris
        </div>
        <h1 className="font-display text-3xl font-semibold">Ubah Barang</h1>
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
