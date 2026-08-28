"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useCabang, useStok } from "@/lib/storage";
import StatCard from "@/components/StatCard";
import { TriangleAlert, ArrowRight, Building2 } from "lucide-react";

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

  // "semua" = gabungan semua cabang (perilaku lama). Selain itu,
  // berisi id cabang yang dipilih dan seluruh angka di halaman ini
  // dihitung ulang khusus untuk cabang tersebut.
  const [cabangTerpilih, setCabangTerpilih] = useState<string>("semua");

  const namaCabang = useCallback(
    (cabangId: string) =>
      daftarCabang.find((c) => c.id === cabangId)?.nama ?? "—",
    [daftarCabang],
  );

  // Barang yang relevan untuk cabang terpilih: kalau "semua", semua
  // barang; kalau cabang tertentu, hanya barang yang PUNYA baris
  // stok di cabang itu (barang bisa saja belum pernah distok di
  // cabang tertentu, jadi tidak masuk hitungan cabang tersebut).
  const barangCabang = useMemo(() => {
    if (cabangTerpilih === "semua") return data;
    return data.filter((b) =>
      b.stokPerCabang.some((s) => s.cabangId === cabangTerpilih),
    );
  }, [data, cabangTerpilih]);

  const totalJenis = barangCabang.length;

  const totalUnit = useMemo(() => {
    if (cabangTerpilih === "semua") {
      return data.reduce((a, b) => a + b.jumlah, 0);
    }
    return barangCabang.reduce((a, b) => {
      const baris = b.stokPerCabang.find(
        (s) => s.cabangId === cabangTerpilih,
      );
      return a + (baris?.jumlah ?? 0);
    }, 0);
  }, [data, barangCabang, cabangTerpilih]);

  const nilaiStok = useMemo(() => {
    if (cabangTerpilih === "semua") {
      return data.reduce((a, b) => a + b.jumlah * b.hargaBeli, 0);
    }
    return barangCabang.reduce((a, b) => {
      const baris = b.stokPerCabang.find(
        (s) => s.cabangId === cabangTerpilih,
      );
      return a + (baris?.jumlah ?? 0) * b.hargaBeli;
    }, 0);
  }, [data, barangCabang, cabangTerpilih]);

  // Satu baris per KOMBINASI barang+cabang yang kritis. Saat
  // "semua", tetap seperti perilaku lama (semua cabang). Saat cabang
  // tertentu dipilih, hanya baris stok cabang itu yang disertakan —
  // supaya daftar ini benar-benar mencerminkan cabang yang sedang
  // dilihat, bukan cabang lain yang kebetulan juga kritis.
  const barisKritis = useMemo(() => {
    return data.flatMap((b) =>
      b.stokPerCabang
        .filter(
          (s) =>
            s.rendah &&
            (cabangTerpilih === "semua" || s.cabangId === cabangTerpilih),
        )
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
  }, [data, cabangTerpilih, namaCabang]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Ringkasan
        </div>
        <h1 className="font-display text-3xl font-semibold">Dasbor Stok</h1>
        <p className="text-ink/60 text-sm mt-1">
          Pantau kondisi persediaan barang Anda secara sekilas.
        </p>
      </header>

      {daftarCabang.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Building2 size={15} className="text-ink/40 shrink-0" />
          <button
            onClick={() => setCabangTerpilih("semua")}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              cabangTerpilih === "semua"
                ? "bg-ink text-paper border-ink"
                : "border-ink/15 text-ink/60 hover:bg-paper"
            }`}
          >
            Semua Cabang
          </button>
          {daftarCabang.map((c) => (
            <button
              key={c.id}
              onClick={() => setCabangTerpilih(c.id)}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                cabangTerpilih === c.id
                  ? "bg-ink text-paper border-ink"
                  : "border-ink/15 text-ink/60 hover:bg-paper"
              }`}
            >
              {c.nama}
            </button>
          ))}
        </div>
      )}

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
              value={String(barisKritis.length)}
              hint={barisKritis.length > 0 ? "perlu perhatian" : "aman"}
              tone={barisKritis.length > 0 ? "warn" : "default"}
            />
          </div>

          <div className="bg-white border border-ink/10 rounded-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
              <div className="flex items-center gap-2">
                <TriangleAlert size={16} className="text-rust" />
                <h2 className="font-medium text-sm">
                  Barang dengan stok di bawah batas minimum
                  {cabangTerpilih !== "semua" &&
                    ` — ${namaCabang(cabangTerpilih)}`}
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
                      {cabangTerpilih === "semua" && (
                        <span className="text-ink/40 text-xs ml-2">
                          · {r.cabangNama}
                        </span>
                      )}
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
