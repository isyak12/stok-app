"use client";

import Link from "next/link";
import { useCabang, useStok } from "@/lib/storage";
import StatCard from "@/components/StatCard";
import { TriangleAlert, ArrowRight } from "lucide-react";

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DasborPage() {
  const { data, siap, error } = useStok();
  const { data: daftarCabang } = useCabang();

  const totalJenis = data.length;
  const totalUnit = data.reduce((a, b) => a + b.jumlah, 0);
  const nilaiStok = data.reduce((a, b) => a + b.jumlah * b.hargaBeli, 0);
  const stokRendah = data.filter((b) => b.stokRendah);

  const namaCabang = (cabangId: string) =>
    daftarCabang.find((c) => c.id === cabangId)?.nama ?? "—";

  // Satu baris per KOMBINASI barang+cabang yang kritis — bukan satu
  // baris per barang dengan angka gabungan semua cabang. Produk yang
  // stoknya ada di banyak cabang dan kritis di lebih dari satu cabang
  // akan muncul lebih dari sekali di sini, masing-masing dengan
  // cabang & angkanya sendiri, supaya jelas cabang mana yang perlu
  // diisi ulang (bukan cuma total gabungan yang membingungkan).
  const barisKritis = stokRendah.flatMap((b) =>
    b.stokPerCabang
      .filter((s) => s.rendah)
      .map((s) => ({
        key: `${b.id}-${s.cabangId}`,
        barangId: b.id,
        nama: b.nama,
        sku: b.sku,
        satuan: b.satuan,
        cabangNama: namaCabang(s.cabangId),
        jumlah: s.jumlah,
        stokMinimum: s.stokMinimum,
      })),
  );

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Ringkasan
        </div>
        <h1 className="font-display text-3xl font-semibold">Dasbor Stok</h1>
        <p className="text-ink/60 text-sm mt-1">
          Pantau kondisi persediaan barang Anda secara sekilas.
        </p>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
          Gagal memuat data dari Supabase: {error}
        </div>
      )}

      {!siap ? (
        <p className="text-ink/40 text-sm">Memuat data...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Jenis Barang" value={String(totalJenis)} />
            <StatCard
              label="Total Unit"
              value={totalUnit.toLocaleString("id-ID")}
            />
            <StatCard
              label="Estimasi Nilai Stok"
              value={formatRupiah(nilaiStok)}
              hint="berdasarkan harga beli"
            />
            <StatCard
              label="Stok Menipis"
              value={String(stokRendah.length)}
              hint={stokRendah.length > 0 ? "perlu perhatian" : "aman"}
              tone={stokRendah.length > 0 ? "warn" : "default"}
            />
          </div>

          <div className="bg-white border border-ink/10 rounded-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
              <div className="flex items-center gap-2">
                <TriangleAlert size={16} className="text-rust" />
                <h2 className="font-medium text-sm">
                  Barang dengan stok di bawah batas minimum
                </h2>
              </div>
              <Link
                href="/stok"
                className="text-xs text-ink/50 hover:text-rust flex items-center gap-1"
              >
                Lihat semua stok <ArrowRight size={12} />
              </Link>
            </div>

            {barisKritis.length === 0 ? (
              <p className="px-5 py-8 text-center text-ink/40 text-sm">
                Semua stok dalam kondisi aman. Tidak ada barang yang perlu diisi
                ulang saat ini.
              </p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {barisKritis.map((r) => (
                  <li
                    key={r.key}
                    className="px-5 py-3 flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium">{r.nama}</span>
                      <span className="text-ink/40 font-mono text-xs ml-2">
                        {r.sku}
                      </span>
                      <span className="text-ink/40 text-xs ml-2">
                        · {r.cabangNama}
                      </span>
                    </div>
                    <div className="font-mono text-rust font-semibold">
                      {r.jumlah} / {r.stokMinimum} {r.satuan}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
