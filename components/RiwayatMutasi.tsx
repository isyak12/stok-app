"use client";

import { useEffect, useState } from "react";
import { useMutasiStok } from "@/lib/useMutasiStok";
import type { MutasiStok } from "@/lib/types-mutasi";

export default function RiwayatMutasi({ produkId }: { produkId: string }) {
  const { getRiwayatMutasi, getLampiranUrl } = useMutasiStok();
  const [data, setData] = useState<MutasiStok[]>([]);

  useEffect(() => {
    getRiwayatMutasi(produkId).then((d) => setData(d as MutasiStok[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produkId]);

  async function bukaLampiran(path: string) {
    const url = await getLampiranUrl(path);
    if (url) window.open(url, "_blank");
  }

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada riwayat mutasi.</p>;
  }

  return (
    <ul className="divide-y">
      {data.map((m) => (
        <li key={m.id} className="py-3">
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-medium ${
                m.jenis === "masuk" ? "text-green-600" : "text-red-600"
              }`}
            >
              {m.jenis === "masuk" ? "Masuk" : "Keluar"} · {m.jumlah} unit
            </span>
            <span className="text-xs text-gray-400">{m.tanggal}</span>
          </div>
          {m.keterangan && <p className="text-sm text-gray-600">{m.keterangan}</p>}
          {m.lampiran && m.lampiran.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {m.lampiran.map((l) => (
                <button
                  key={l.id}
                  onClick={() => bukaLampiran(l.file_path)}
                  className="text-xs text-blue-600 underline"
                >
                  📎 {l.file_name}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
