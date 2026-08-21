"use client";

import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  XCircle,
} from "lucide-react";
import { Cabang, MutasiStok, StatusTransfer } from "@/lib/types";

type Props = {
  data: MutasiStok[];
  daftarCabang: Cabang[];
};

function formatTanggal(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Badge({ mutasi }: { mutasi: MutasiStok }) {
  if (mutasi.jenis === "transfer") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-ink/5 text-ink/70">
        <ArrowRightLeft size={12} />
        Transfer
      </span>
    );
  }
  const masuk = mutasi.jenis === "masuk";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
        masuk ? "bg-moss/10 text-moss" : "bg-rust/10 text-rust"
      } ${mutasi.dibatalkan ? "line-through decoration-2" : ""}`}
    >
      {masuk ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
      {masuk ? "Masuk" : "Keluar"}
    </span>
  );
}

// Badge kecil "Dibatalkan" untuk entri transaksi masuk/keluar yang
// sudah divoid (lihat supabase/pembatalan_transaksi.sql). Tanpa ini,
// transaksi yang sebetulnya sudah tidak berlaku terlihat sama persis
// dengan transaksi yang masih aktif di linimasa Riwayat Mutasi.
function StatusTransaksiBadge({ alasan }: { alasan: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-ink/5 text-ink/60">
      <XCircle size={11} />
      {alasan ? `Dibatalkan: ${alasan}` : "Dibatalkan"}
    </span>
  );
}

// Status kirim -> terima untuk entri transfer. Tanpa ini, transfer
// yang stok tujuannya BELUM ditambahkan (masih "terkirim") terlihat
// sama persis dengan yang sudah selesai — bisa membingungkan staf
// cabang tujuan mengira barang sudah pasti sampai & tercatat.
function StatusTransferBadge({ status }: { status: StatusTransfer }) {
  if (status === "dibatalkan") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-rust/10 text-rust">
        <XCircle size={11} />
        Dibatalkan
      </span>
    );
  }
  const diterima = status === "diterima";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium ${
        diterima ? "bg-moss/10 text-moss" : "bg-amber-500/10 text-amber-700"
      }`}
    >
      {diterima ? "Diterima" : "Menunggu diterima"}
    </span>
  );
}

export default function RiwayatMutasiTable({ data, daftarCabang }: Props) {
  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  return (
    <div className="bg-white border border-ink/10 rounded-sm overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Jenis</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">
              Detail
            </th>
            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
            <th className="px-4 py-3 font-medium">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => {
            const tanda = m.jenis === "keluar" ? "-" : "+";
            const dibatalkan =
              m.jenis === "transfer"
                ? m.status === "dibatalkan"
                : m.dibatalkan;
            return (
              <tr
                key={`${m.jenis}-${m.id}`}
                className={`border-b border-ink/5 last:border-0 hover:bg-paper/50 ${
                  dibatalkan ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3 text-ink/70 font-mono text-xs whitespace-nowrap">
                  {formatTanggal(m.dibuatPada)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <Badge mutasi={m} />
                    {m.jenis === "transfer" && (
                      <StatusTransferBadge status={m.status} />
                    )}
                    {m.jenis !== "transfer" && m.dibatalkan && (
                      <StatusTransaksiBadge alasan={m.alasanPembatalan} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink/70 hidden sm:table-cell">
                  {m.jenis === "transfer"
                    ? `${namaCabang(m.dariCabangId)} → ${namaCabang(m.keCabangId)}`
                    : namaCabang(m.cabangId)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    dibatalkan ? "line-through decoration-2" : ""
                  }`}
                >
                  {tanda}
                  {m.jumlah}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {m.catatan || <span className="text-ink/30">—</span>}
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                Belum ada mutasi stok untuk barang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
