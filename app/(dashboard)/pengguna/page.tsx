"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { labelPeran, Peran } from "@/lib/role";

type PenggunaBaris = {
  id: string;
  username: string;
  peran: Peran;
  dibuatPada: string;
};

function formatTanggal(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default function KelolaPenggunaPage() {
  const { peran, siap: userSiap, isSuperadmin, user } = useUser();

  const [data, setData] = useState<PenggunaBaris[]>([]);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [peranBaru, setPeranBaru] = useState<"admin" | "staf">("staf");
  const [menyimpan, setMenyimpan] = useState(false);
  const [memproses, setMemproses] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    setSiap(false);
    try {
      const res = await fetch("/api/pengguna");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat pengguna.");
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengguna.");
    } finally {
      setSiap(true);
    }
  }, []);

  useEffect(() => {
    if (isSuperadmin) muatUlang();
  }, [isSuperadmin, muatUlang]);

  async function tambahPengguna(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setError(null);
    try {
      const res = await fetch("/api/pengguna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, peran: peranBaru }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat pengguna.");
      setUsername("");
      setPassword("");
      setPeranBaru("staf");
      await muatUlang();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pengguna.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function ubahPeran(id: string, peranBaru: "admin" | "staf") {
    setMemproses(id);
    setError(null);
    try {
      const res = await fetch("/api/pengguna", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, peran: peranBaru }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengubah peran.");
      await muatUlang();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah peran.");
    } finally {
      setMemproses(null);
    }
  }

  async function hapusPengguna(id: string, username: string) {
    if (!confirm(`Hapus akun "${username}"? Tindakan ini tidak bisa dibatalkan.`))
      return;
    setMemproses(id);
    setError(null);
    try {
      const res = await fetch("/api/pengguna", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menghapus pengguna.");
      await muatUlang();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus pengguna.");
    } finally {
      setMemproses(null);
    }
  }

  if (!userSiap) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-ink/40 text-sm">Memuat data...</p>
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="p-4 sm:p-8">
        <div className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl flex items-start gap-3">
          <ShieldAlert size={20} className="text-rust shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-ink">
              Kelola Pengguna khusus untuk akun superadmin.
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
          Administrasi
        </div>
        <h1 className="font-display text-3xl font-semibold">
          Kelola Pengguna
        </h1>
        <p className="text-sm text-ink/60 mt-1">
          Buat akun baru untuk staf atau admin, dan atur perannya.
        </p>
      </div>

      {error && (
        <div className="mb-4 max-w-2xl bg-rust/10 border border-rust/30 text-rust text-sm rounded-sm px-4 py-3">
          {error}
        </div>
      )}

      <form
        onSubmit={tambahPengguna}
        className="bg-white border border-ink/10 rounded-sm p-6 max-w-2xl mb-8"
      >
        <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-rust" />
          Tambah Akun Baru
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="block text-ink/60 mb-1">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="mis. budi"
              className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-ink/60 mb-1">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="min. 6 karakter"
              className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-ink/60 mb-1">Peran</span>
            <select
              value={peranBaru}
              onChange={(e) => setPeranBaru(e.target.value as "admin" | "staf")}
              className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm bg-white"
            >
              <option value="staf">Staf Gudang</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={menyimpan}
          className="mt-4 px-4 py-2 bg-ink text-paper text-sm rounded-sm hover:bg-ink/90 disabled:opacity-50"
        >
          {menyimpan ? "Menyimpan..." : "Buat Akun"}
        </button>
      </form>

      <div className="bg-white border border-ink/10 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50 border-b border-ink/10 bg-paper/60">
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Peran</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">
                Dibuat
              </th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!siap ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/40">
                  Memuat...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/40">
                  Belum ada pengguna.
                </td>
              </tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3">
                    {p.username}
                    {p.id === user?.id && (
                      <span className="ml-2 text-[10px] uppercase text-ink/40">
                        (Anda)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.peran === "superadmin" ? (
                      <span className="text-[11px] uppercase tracking-wider text-rust font-mono">
                        Superadmin
                      </span>
                    ) : (
                      <select
                        value={p.peran}
                        disabled={memproses === p.id}
                        onChange={(e) =>
                          ubahPeran(p.id, e.target.value as "admin" | "staf")
                        }
                        className="border border-ink/15 rounded-sm px-2 py-1 text-xs bg-white disabled:opacity-50"
                      >
                        <option value="staf">Staf Gudang</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink/60">
                    {formatTanggal(p.dibuatPada)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.peran !== "superadmin" && p.id !== user?.id && (
                      <button
                        onClick={() => hapusPengguna(p.id, p.username)}
                        disabled={memproses === p.id}
                        className="text-ink/40 hover:text-rust disabled:opacity-50"
                        title="Hapus akun"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
