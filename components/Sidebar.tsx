"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid,
  Boxes,
  PackagePlus,
  LogOut,
  Menu,
  X,
  Users,
  History,
  KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { labelPeran, Peran } from "@/lib/role";
import NotifikasiTransferMasuk from "./NotifikasiTransferMasuk";

const NAV = [
  { href: "/", label: "Dasbor", icon: LayoutGrid },
  { href: "/stok", label: "Daftar Stok", icon: Boxes },
  {
    href: "/stok/tambah",
    label: "Tambah Barang",
    icon: PackagePlus,
    perananBoleh: ["admin", "superadmin"] as Peran[],
  },
  {
    href: "/log-aktivitas",
    label: "Log Aktivitas",
    icon: History,
    perananBoleh: ["admin", "superadmin"] as Peran[],
  },
  {
    href: "/pengguna",
    label: "Kelola Pengguna",
    icon: Users,
    perananBoleh: ["superadmin"] as Peran[],
  },
];

export default function Sidebar({
  username,
  peran,
}: {
  username: string;
  peran: Peran;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);

  async function keluar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navTerlihat = NAV.filter(
    (item) => !item.perananBoleh || item.perananBoleh.includes(peran),
  );

  return (
    <>
      {/* Topbar khusus mobile — sidebar penuh disembunyikan di layar kecil */}
      <div className="md:hidden flex items-center justify-between bg-ink text-paper px-4 py-3 sticky top-0 z-30">
        <div className="font-display text-lg font-700 tracking-tight">
          STOK - Skynet
        </div>
        <div className="flex items-center gap-1">
          <NotifikasiTransferMasuk />
          <button
            onClick={() => setTerbuka(true)}
            className="p-2 -mr-2 text-wheat/80 hover:text-paper"
            aria-label="Buka menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Overlay gelap di belakang menu saat terbuka (mobile saja) */}
      {terbuka && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setTerbuka(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 shrink-0 bg-ink text-paper flex flex-col
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
          ${terbuka ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:z-30`}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5 divider-barcode opacity-40" />
        <div className="flex items-start justify-between px-6 pt-8 pb-6">
          <div>
            <div className="font-display text-2xl font-700 tracking-tight">
              STOK - SKYNET
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-wheat/70 mt-1">
              Manajemen Stok Barang
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden md:block">
              <NotifikasiTransferMasuk />
            </div>
            <button
              onClick={() => setTerbuka(false)}
              className="md:hidden p-1 -mt-1 -mr-2 text-wheat/60 hover:text-paper"
              aria-label="Tutup menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="divider-barcode text-paper mx-6" />
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navTerlihat.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setTerbuka(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors border-l-2 ${
                  active
                    ? "bg-white/5 border-rust text-paper font-medium"
                    : "border-transparent text-wheat/70 hover:text-paper hover:bg-white/5"
                }`}
              >
                <Icon size={17} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="divider-barcode text-paper mx-6" />
        <div className="px-4 py-4">
          {username && (
            <div className="px-3 mb-2 truncate" title={username}>
              <div className="text-xs text-wheat/60">{username}</div>
              <div className="text-[10px] uppercase tracking-wider text-rust/80 font-mono mt-0.5">
                {labelPeran(peran)}
              </div>
            </div>
          )}

          <Link
            href="/akun/ubah-password"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-wheat/70 hover:text-paper hover:bg-white/5 transition-colors"
          >
            <KeyRound size={17} strokeWidth={1.75} />
            Ubah Password
          </Link>

          <button
            onClick={keluar}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-wheat/70 hover:text-paper hover:bg-white/5 transition-colors"
          >
            <LogOut size={17} strokeWidth={1.75} />
            Keluar
          </button>
        </div>
        <div className="px-6 py-4 text-[11px] text-wheat/50 font-mono border-t border-white/5">
          v1.1 — STOK-SKYNET
        </div>
      </aside>
    </>
  );
}
