"use client";

// ============================================================
// Komponen UbahPasswordForm (v3 — memakai identitas visual
// STOK-SKYNET: warna ink/wheat/rust/paper, font-display,
// divider-barcode, label mono uppercase seperti StatCard/Sidebar)
// Ganti isi components/UbahPasswordForm.tsx dengan ini.
// ============================================================

import { useState } from "react";
import { KeyRound, Eye, EyeOff, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function kekuatanPassword(pw: string): { label: string; warna: string; skor: number } {
  if (!pw) return { label: "", warna: "bg-ink/10", skor: 0 };
  let skor = 0;
  if (pw.length >= 6) skor++;
  if (pw.length >= 10) skor++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) skor++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) skor++;

  if (skor <= 1) return { label: "Lemah", warna: "bg-rust", skor };
  if (skor === 2) return { label: "Cukup", warna: "bg-rust/70", skor };
  if (skor === 3) return { label: "Baik", warna: "bg-ink/60", skor };
  return { label: "Kuat", warna: "bg-ink", skor };
}

function InputPassword({
  id,
  label,
  value,
  onChange,
  autoComplete,
  helperText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  helperText?: string;
}) {
  const [tampil, setTampil] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] uppercase tracking-wider font-mono text-ink/60 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={tampil ? "text" : "password"}
          autoComplete={autoComplete}
          className="w-full rounded-sm border border-ink/15 bg-paper px-3.5 py-2.5 pr-11 text-sm text-ink placeholder:text-ink/30 transition focus:border-rust focus:outline-none focus:ring-1 focus:ring-rust"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setTampil((t) => !t)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-ink/35 hover:text-ink/70 transition-colors"
          aria-label={tampil ? "Sembunyikan password" : "Tampilkan password"}
        >
          {tampil ? (
            <EyeOff size={17} strokeWidth={1.75} />
          ) : (
            <Eye size={17} strokeWidth={1.75} />
          )}
        </button>
      </div>
      {helperText && (
        <p className="text-xs text-ink/40 font-mono mt-1.5">{helperText}</p>
      )}
    </div>
  );
}

export default function UbahPasswordForm() {
  const supabase = createClient();

  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPasswordBaru, setKonfirmasiPasswordBaru] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const kekuatan = kekuatanPassword(passwordBaru);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSukses(false);

    if (passwordBaru.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    if (passwordBaru !== konfirmasiPasswordBaru) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (passwordBaru === passwordLama) {
      setError("Password baru tidak boleh sama dengan password lama.");
      return;
    }

    setMenyimpan(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      const { error: errVerifikasi } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordLama,
      });

      if (errVerifikasi) {
        throw new Error("Password lama yang Anda masukkan salah.");
      }

      const { error: errUpdate } = await supabase.auth.updateUser({
        password: passwordBaru,
      });

      if (errUpdate) {
        throw new Error(errUpdate.message);
      }

      setSukses(true);
      setPasswordLama("");
      setPasswordBaru("");
      setKonfirmasiPasswordBaru("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah password.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div className="relative max-w-md bg-paper border border-ink/10 shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-1 divider-barcode opacity-30" />

      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-sm bg-ink text-paper shrink-0">
          <KeyRound size={16} strokeWidth={1.75} />
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-ink/50">
          Keamanan Akun
        </div>
      </div>

      <div className="divider-barcode mx-6" />

      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-sm bg-rust/10 border border-rust/30 text-rust text-sm px-3.5 py-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {sukses && (
          <div className="flex items-start gap-2 rounded-sm bg-ink/5 border border-ink/20 text-ink text-sm px-3.5 py-2.5">
            <Check size={16} className="shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>Password berhasil diubah.</span>
          </div>
        )}

        <InputPassword
          id="password-lama"
          label="Password saat ini"
          value={passwordLama}
          onChange={setPasswordLama}
          autoComplete="current-password"
        />

        <div>
          <InputPassword
            id="password-baru"
            label="Password baru"
            value={passwordBaru}
            onChange={setPasswordBaru}
            autoComplete="new-password"
            helperText="Minimal 6 karakter."
          />
          {passwordBaru && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-ink/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${kekuatan.warna}`}
                  style={{ width: `${(kekuatan.skor / 4) * 100}%` }}
                />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-mono text-ink/40 w-12 shrink-0 text-right">
                {kekuatan.label}
              </span>
            </div>
          )}
        </div>

        <InputPassword
          id="konfirmasi-password-baru"
          label="Konfirmasi password baru"
          value={konfirmasiPasswordBaru}
          onChange={setKonfirmasiPasswordBaru}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={menyimpan}
          className="w-full rounded-sm bg-ink text-paper text-sm font-medium py-2.5 transition hover:bg-ink/90 disabled:opacity-50 disabled:hover:bg-ink"
        >
          {menyimpan ? "Menyimpan..." : "Ubah Password"}
        </button>
      </form>
    </div>
  );
}
