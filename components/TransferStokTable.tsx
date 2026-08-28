"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Clock, ImageOff, XCircle } from "lucide-react";
import { TransferStok, Cabang } from "@/lib/types";
import { pesanError } from "@/lib/error";

type Props = {
  data: TransferStok[];
  daftarCabang: Cabang[];
  onKonfirmasiTerima?: (
    transferId: string,
    fotoBukti: File,
    catatanPenerimaan?: string,
  ) => Promise<void>;
  onBatalkan?: (transferId: string, alasan?: string) => Promise<void>;
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

// Batas ukuran file foto bukti penerimaan, dijaga di sisi client
// supaya user dapat pesan error yang jelas sebelum upload dicoba
// (bucket Supabase Storage sendiri tidak dibatasi ukurannya lewat
// migrasi ini).
const MAKS_UKURAN_FOTO_MB = 5;

export default function TransferStokTable({
  data,
  daftarCabang,
  onKonfirmasiTerima,
  onBatalkan,
}: Props) {
  const [memproses, setMemproses] = useState<string | null>(null);
  // Id transfer yang sedang membuka form konfirmasi terima (null =
  // tidak ada form yang terbuka).
  const [formTerimaId, setFormTerimaId] = useState<string | null>(null);
  const [fotoBukti, setFotoBukti] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [catatanPenerimaan, setCatatanPenerimaan] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  // Foto yang sedang diperbesar (lightbox), null = tidak ada.
  const [fotoDiperbesar, setFotoDiperbesar] = useState<string | null>(null);

  // Bersihkan object URL preview saat komponen unmount (mis. user
  // pindah halaman saat form konfirmasi terima masih terbuka) --
  // pakai ref supaya cleanup baca nilai preview PALING BARU, bukan
  // snapshot dari render pertama.
  const previewFotoRef = useRef(previewFoto);
  previewFotoRef.current = previewFoto;
  useEffect(() => {
    return () => {
      if (previewFotoRef.current) URL.revokeObjectURL(previewFotoRef.current);
    };
  }, []);

  function namaCabang(id: string) {
    return daftarCabang.find((c) => c.id === id)?.nama ?? "—";
  }

  function bukaFormTerima(id: string) {
    setFormTerimaId(id);
    setFotoBukti(null);
    setPreviewFoto(null);
    setCatatanPenerimaan("");
    setErrorForm(null);
  }

  function tutupFormTerima() {
    if (previewFoto) URL.revokeObjectURL(previewFoto);
    setFormTerimaId(null);
    setFotoBukti(null);
    setPreviewFoto(null);
    setCatatanPenerimaan("");
    setErrorForm(null);
  }

  function pilihFoto(file: File | null) {
    if (previewFoto) URL.revokeObjectURL(previewFoto);
    if (!file) {
      setFotoBukti(null);
      setPreviewFoto(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrorForm("File harus berupa gambar (JPG, PNG, dsb).");
      setFotoBukti(null);
      setPreviewFoto(null);
      return;
    }
    if (file.size > MAKS_UKURAN_FOTO_MB * 1024 * 1024) {
      setErrorForm(`Ukuran foto maksimal ${MAKS_UKURAN_FOTO_MB}MB.`);
      setFotoBukti(null);
      setPreviewFoto(null);
      return;
    }
    setErrorForm(null);
    setFotoBukti(file);
    setPreviewFoto(URL.createObjectURL(file));
  }

  async function konfirmasi(id: string) {
    if (!onKonfirmasiTerima) return;
    if (!fotoBukti) {
      setErrorForm("Foto bukti penerimaan wajib diunggah.");
      return;
    }
    setMemproses(id);
    try {
      await onKonfirmasiTerima(id, fotoBukti, catatanPenerimaan);
      tutupFormTerima();
    } catch (err) {
      setErrorForm(pesanError(err, "Gagal mengonfirmasi transfer."));
    } finally {
      setMemproses(null);
    }
  }

  async function batalkan(id: string) {
    if (!onBatalkan) return;
    if (
      !confirm(
        "Batalkan transfer ini? Stok akan dikembalikan ke cabang asal.",
      )
    )
      return;
    const alasan = prompt(
      "Alasan pembatalan (opsional, boleh dikosongkan):",
      "",
    );
    // prompt() mengembalikan null kalau user klik "Cancel" pada dialog
    // alasan — bedakan dari string kosong ("") supaya user yang sengaja
    // membatalkan tanpa alasan tetap bisa lanjut, sementara yang benar-
    // benar berubah pikiran (klik Cancel) tidak jadi membatalkan transfer.
    if (alasan === null) return;
    setMemproses(id);
    try {
      await onBatalkan(id, alasan);
    } catch (err) {
      alert(pesanError(err, "Gagal membatalkan transfer."));
    } finally {
      setMemproses(null);
    }
  }

  return (
    <div className="bg-white border border-ink/10 rounded-sm overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
            <th className="px-4 py-3 font-medium">Tanggal</th>
            <th className="px-4 py-3 font-medium">Dari</th>
            <th className="px-4 py-3 font-medium">Ke</th>
            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Dikirim oleh
            </th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">
              Diterima oleh
            </th>
            <th className="px-4 py-3 font-medium">Bukti</th>
            <th className="px-4 py-3 font-medium">Catatan</th>
            {(onKonfirmasiTerima || onBatalkan) && (
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((t) => {
            const terkirim = t.status === "terkirim";
            const dibatalkan = t.status === "dibatalkan";
            const diterima = t.status === "diterima";
            const formTerbuka = formTerimaId === t.id;
            return (
              // Fragment butuh key sendiri di dalam .map() (bukan di
              // <tr> pertama sebagai child) supaya React bisa
              // mengidentifikasi tiap grup <tr>+<tr form> dengan benar.
              <Fragment key={t.id}>
                <tr
                  className={`border-b border-ink/5 last:border-0 hover:bg-paper/50 ${
                    dibatalkan ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-ink/70 font-mono text-xs whitespace-nowrap">
                    {formatTanggal(t.dibuatPada)}
                  </td>
                  <td className="px-4 py-3">{namaCabang(t.dariCabangId)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <ArrowRightLeft size={12} className="text-ink/40" />
                      {namaCabang(t.keCabangId)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{t.jumlah}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
                        dibatalkan
                          ? "bg-rust/10 text-rust"
                          : terkirim
                            ? "bg-wheat/30 text-ink/70"
                            : "bg-moss/10 text-moss"
                      }`}
                    >
                      {dibatalkan ? (
                        <XCircle size={12} />
                      ) : terkirim ? (
                        <Clock size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      {dibatalkan ? "Dibatalkan" : terkirim ? "Terkirim" : "Diterima"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                    {t.dibuatOlehNama || <span className="text-ink/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink/70 hidden md:table-cell">
                    {dibatalkan ? (
                      <span className="text-rust/80">
                        {t.dibatalkanOlehNama || "—"}
                      </span>
                    ) : (
                      t.diterimaOlehNama || <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {diterima && t.buktiFotoUrl ? (
                      <button
                        type="button"
                        onClick={() => setFotoDiperbesar(t.buktiFotoUrl)}
                        className="block w-10 h-10 rounded-sm overflow-hidden border border-ink/15 hover:border-ink/40 transition-colors"
                        title="Lihat foto bukti penerimaan"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.buktiFotoUrl}
                          alt="Bukti penerimaan"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : diterima ? (
                      <span
                        className="inline-flex items-center gap-1 text-ink/30 text-xs"
                        title="Transfer ini dikonfirmasi sebelum fitur bukti foto ada"
                      >
                        <ImageOff size={14} />
                      </span>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {dibatalkan && t.alasanPembatalan
                      ? `Dibatalkan: ${t.alasanPembatalan}`
                      : t.catatan || <span className="text-ink/30">—</span>}
                    {diterima && t.catatanPenerimaan && (
                      <div className="text-xs text-ink/50 mt-0.5">
                        Saat terima: {t.catatanPenerimaan}
                      </div>
                    )}
                  </td>
                  {(onKonfirmasiTerima || onBatalkan) && (
                    <td className="px-4 py-3 text-right">
                      {terkirim && (
                        <div className="flex items-center justify-end gap-2">
                          {onKonfirmasiTerima && (
                            <button
                              onClick={() =>
                                formTerbuka
                                  ? tutupFormTerima()
                                  : bukaFormTerima(t.id)
                              }
                              disabled={memproses === t.id}
                              className="px-3 py-1.5 border border-ink/15 text-xs font-medium rounded-sm hover:bg-paper transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {formTerbuka ? "Batal" : "Tandai Diterima"}
                            </button>
                          )}
                          {onBatalkan && (
                            <button
                              onClick={() => batalkan(t.id)}
                              disabled={memproses === t.id}
                              className="px-3 py-1.5 border border-rust/30 text-rust text-xs font-medium rounded-sm hover:bg-rust/10 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {memproses === t.id ? "Memproses..." : "Batalkan"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                {formTerbuka && (
                  <tr className="border-b border-ink/5 bg-paper/40">
                    <td colSpan={10} className="px-4 py-4">
                      <div className="max-w-lg space-y-3">
                        <p className="text-xs text-ink/60">
                          Unggah foto bukti barang sudah diterima di{" "}
                          {namaCabang(t.keCabangId)}. Foto wajib diisi.
                        </p>
                        <div className="flex items-start gap-3">
                          <label className="px-3 py-1.5 border border-ink/15 text-xs font-medium rounded-sm hover:bg-paper cursor-pointer whitespace-nowrap">
                            Pilih Foto
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) =>
                                pilihFoto(e.target.files?.[0] ?? null)
                              }
                            />
                          </label>
                          {previewFoto && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={previewFoto}
                              alt="Pratinjau bukti penerimaan"
                              className="w-16 h-16 object-cover rounded-sm border border-ink/15"
                            />
                          )}
                        </div>
                        <textarea
                          value={catatanPenerimaan}
                          onChange={(e) => setCatatanPenerimaan(e.target.value)}
                          placeholder="Catatan penerimaan (opsional) — mis. kondisi barang, selisih jumlah, dsb."
                          rows={2}
                          className="w-full px-3 py-2 border border-ink/15 rounded-sm text-sm focus:outline-none focus:border-ink/40"
                        />
                        {errorForm && (
                          <p className="text-rust text-xs">{errorForm}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => konfirmasi(t.id)}
                            disabled={memproses === t.id || !fotoBukti}
                            className="px-3 py-1.5 bg-ink text-white text-xs font-medium rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {memproses === t.id
                              ? "Memproses..."
                              : "Konfirmasi Diterima"}
                          </button>
                          <button
                            onClick={tutupFormTerima}
                            disabled={memproses === t.id}
                            className="px-3 py-1.5 text-xs text-ink/60 hover:text-ink transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={onKonfirmasiTerima || onBatalkan ? 10 : 9}
                className="px-4 py-10 text-center text-ink/40 text-sm"
              >
                Belum ada transfer stok untuk barang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {fotoDiperbesar && (
        <div
          className="fixed inset-0 bg-ink/80 flex items-center justify-center p-4 z-50"
          onClick={() => setFotoDiperbesar(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoDiperbesar}
            alt="Bukti penerimaan (diperbesar)"
            className="max-w-full max-h-full rounded-sm"
          />
        </div>
      )}
    </div>
  );
}
