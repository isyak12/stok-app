"use client";

// ============================================================
// Komponen UbahPasswordForm (v2 — tampilan card)
// Ganti isi components/UbahPasswordForm.tsx dengan ini.
// Tidak ada perubahan logika dari versi sebelumnya, murni UI.
// ============================================================

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function IkonMata({ tertutup }: { tertutup: boolean }) {
  if (tertutup) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function kekuatanPassword(pw: string): { label: string; warna: string; skor: number } {
  if (!pw) return { label: "", warna: "bg-gray-200", skor: 0 };
  let skor = 0;
  if (pw.length >= 6) skor++;
  if (pw.length >= 10) skor++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) skor++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) skor++;

  if (skor <= 1) return { label: "Lemah", warna: "bg-red-400", skor };
  if (skor === 2) return { label: "Cukup", warna: "bg-yellow-400", skor };
  if (skor === 3) return { label: "Baik", warna: "bg-blue-400", skor };
  return { label: "Kuat", warna: "bg-green-500", skor };
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
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={tampil ? "text" : "password"}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-11 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setTampil((t) => !t)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
          aria-label={tampil ? "Sembunyikan password" : "Tampilkan password"}
        >
          <IkonMata tertutup={!tampil} />
        </button>
      </div>
      {helperText && <p className="text-xs text-gray-400 mt-1.5">{helperText}</p>}
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
    <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {sukses && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-3.5 py-2.5">
            <span>✓</span>
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
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${kekuatan.warna}`}
                  style={{ width: `${(kekuatan.skor / 4) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-12 shrink-0">{kekuatan.label}</span>
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
          className="w-full rounded-lg bg-gray-900 text-white text-sm font-medium py-2.5 transition hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900"
        >
          {menyimpan ? "Menyimpan..." : "Ubah Password"}
        </button>
      </form>
    </div>
  );
}
