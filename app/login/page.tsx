"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameKeEmail } from "@/lib/username";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMemuat(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameKeEmail(username),
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Username atau kata sandi salah."
          : error.message,
      );
      setMemuat(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rust/20 text-rust mb-4">
            <Lock size={20} />
          </div>
          <div className="font-display text-2xl font-700 text-paper tracking-tight">
            STOK - SKYNET
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-wheat/60 mt-1">
            Masuk untuk mengelola stok
          </div>
        </div>

        <form
          onSubmit={submit}
          className="bg-paper rounded-sm p-6 border border-white/10"
        >
          {error && (
            <div className="mb-4 px-4 py-3 bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
              Username
            </span>
            <input
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="superadmin"
              className="input"
            />
          </label>

          <label className="block mb-6">
            <span className="text-[11px] uppercase tracking-wider text-ink/50 block mb-1.5">
              Kata Sandi
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </label>

          <button
            type="submit"
            disabled={memuat}
            className="w-full px-5 py-2.5 bg-ink text-paper text-sm font-medium rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {memuat ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="text-center text-xs text-wheat/40 mt-6">
          Belum punya akun? Hubungi admin untuk dibuatkan akses.
        </p>
      </div>
    </div>
  );
}
