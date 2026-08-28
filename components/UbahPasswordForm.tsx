"use client";

// ============================================================
// Komponen UbahPasswordForm
// Taruh di components/UbahPasswordForm.tsx
// ============================================================

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UbahPasswordForm() {
  const supabase = createClient();

  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPasswordBaru, setKonfirmasiPasswordBaru] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

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
      // Ambil email user yang sedang login, untuk verifikasi password lama.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      // Verifikasi password lama BENAR sebelum mengganti, dengan cara
      // mencoba sign-in ulang pakai email + password lama. Supabase
      // tidak punya endpoint "cek password" terpisah, jadi ini cara
      // yang dipakai secara umum. Kalau salah, signIn akan gagal dan
      // password TIDAK jadi diganti.
      const { error: errVerifikasi } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordLama,
      });

      if (errVerifikasi) {
        throw new Error("Password lama yang Anda masukkan salah.");
      }

      // Password lama benar, sekarang ganti ke password baru.
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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {sukses && (
        <div className="rounded-md bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2">
          Password berhasil diubah.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Password saat ini
        </label>
        <input
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border px-3 py-2"
          value={passwordLama}
          onChange={(e) => setPasswordLama(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Password baru
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border px-3 py-2"
          value={passwordBaru}
          onChange={(e) => setPasswordBaru(e.target.value)}
          required
          minLength={6}
        />
        <p className="text-xs text-gray-400 mt-1">Minimal 6 karakter.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Konfirmasi password baru
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border px-3 py-2"
          value={konfirmasiPasswordBaru}
          onChange={(e) => setKonfirmasiPasswordBaru(e.target.value)}
          required
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={menyimpan}
        className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {menyimpan ? "Menyimpan..." : "Ubah Password"}
      </button>
    </form>
  );
}
