"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useStok } from "@/lib/storage";
import { useUser } from "@/lib/useUser";
import StokForm from "@/components/StokForm";
import { adalahAdminAtauLebih } from "@/lib/role";

export default function TambahStokPage() {
  const { tambah } = useStok();
  const { peran, siap } = useUser();
  const router = useRouter();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Inventaris
        </div>
        <h1 className="font-display text-3xl font-semibold">
          Tambah Barang Baru
        </h1>
      </div>

      {!siap ? (
        <p className="text-ink/40 text-sm">Memuat data...</p>
      ) : !adalahAdminAtauLebih(peran) ? (
        <div className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl flex items-start gap-3">
          <ShieldAlert size={20} className="text-rust shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-ink">
              Menambah barang baru khusus untuk akun admin.
            </p>
            <p className="text-sm text-ink/60 mt-1">
              Hubungi admin kalau perlu mendaftarkan barang baru ke sistem.
            </p>
            <button
              onClick={() => router.push("/stok")}
              className="mt-4 px-4 py-2 border border-ink/15 text-sm rounded-sm hover:bg-paper"
            >
              Kembali ke daftar stok
            </button>
          </div>
        </div>
      ) : (
        <StokForm judul="Detail Barang" onSimpan={tambah} />
      )}
    </div>
  );
}
