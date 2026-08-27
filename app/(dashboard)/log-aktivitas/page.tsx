"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Trash2, TrendingDown, ShieldAlert } from "lucide-react";
import { useLogAktivitasBarang } from "@/lib/storage";
import { useUser } from "@/lib/useUser";
import { emailKeUsername } from "@/lib/username";
import { adalahAdminAtauLebih, labelPeran } from "@/lib/role";
import { AksiLogBarang } from "@/lib/types";

function formatTanggal(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Email internal -> username saja untuk ditampilkan (lihat
// lib/username.ts). auth.email() bisa null pada baris lama/aneh,
// makanya dijaga dengan fallback "-".
function tampilkanNama(emailAtauNull: string | null) {
  if (!emailAtauNull) return "—";
  return emailAtauNull.includes("@")
    ? emailKeUsername(emailAtauNull)
    : emailAtauNull;
}

const FILTER: { value: AksiLogBarang | "semua"; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "tambah", label: "Barang Ditambahkan" },
  { value: "kurangi", label: "Stok Berkurang" },
  { value: "hapus", label: "Barang Dihapus" },
];

function BadgeAksi({ aksi }: { aksi: AksiLogBarang }) {
  if (aksi === "tambah") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-sm px-2 py-1">
        <PackagePlus size={13} /> Ditambahkan
      </span>
    );
  }
  if (aksi === "hapus") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rust bg-rust/10 border border-rust/25 rounded-sm px-2 py-1">
        <Trash2 size={13} /> Dihapus
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-2 py-1">
      <TrendingDown size={13} /> Berkurang
    </span>
  );
}

export default function LogAktivitasPage() {
  const { peran, siap: userSiap } = useUser();
  const { data, siap, error } = useLogAktivitasBarang();
  const [filter, setFilter] = useState<AksiLogBarang | "semua">("semua");

  const dataTerfilter = useMemo(
    () => (filter === "semua" ? data : data.filter((d) => d.aksi === filter)),
    [data, filter],
  );

  if (!userSiap) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-ink/40 text-sm">Memuat data...</p>
      </div>
    );
  }

  if (!adalahAdminAtauLebih(peran)) {
    return (
      <div className="p-4 sm:p-8">
        <div className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl flex items-start gap-3">
          <ShieldAlert size={20} className="text-rust shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-ink">
              Log Aktivitas khusus untuk akun admin ke atas.
            </p>
            <p className="text-sm text-ink/60 mt-1">
              Akun Anda saat ini berperan &ldquo;{labelPeran(peran)}&rdquo;.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-rust font-mono mb-1">
          Audit
        </div>
        <h1 className="font-display text-3xl font-semibold">
          Log Aktivitas Barang
        </h1>
        <p className="text-sm text-ink/60 mt-1">
          Jejak siapa menambahkan barang baru, mengurangi stok, atau
          menghapus barang. Tercatat otomatis, tidak bisa diedit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              filter === f.value
                ? "bg-ink text-paper border-ink"
                : "border-ink/15 text-ink/60 hover:bg-paper"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
              <th className="px-4 py-3 font-medium">Barang</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">
                Cabang
              </th>
              <th className="px-4 py-3 font-medium text-right">Jumlah</th>
              <th className="px-4 py-3 font-medium">Oleh</th>
            </tr>
          </thead>
          <tbody>
            {!siap ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/40">
                  Memuat...
                </td>
              </tr>
            ) : dataTerfilter.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/40">
                  Belum ada aktivitas tercatat.
                </td>
              </tr>
            ) : (
              dataTerfilter.map((log) => (
                <tr key={log.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 text-ink/60 whitespace-nowrap">
                    {formatTanggal(log.dilakukanPada)}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeAksi aksi={log.aksi} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.produkNama}</div>
                    <div className="text-xs text-ink/40 font-mono">
                      {log.produkSku}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink/60">
                    {log.cabangNama ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {log.jumlah ?? "—"}
                  </td>
                  <td className="px-4 py-3">{tampilkanNama(log.dilakukanOlehNama)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
