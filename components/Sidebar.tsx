"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Boxes, PackagePlus } from "lucide-react";

const NAV = [
  { href: "/", label: "Dasbor", icon: LayoutGrid },
  { href: "/stok", label: "Daftar Stok", icon: Boxes },
  { href: "/stok/tambah", label: "Tambah Barang", icon: PackagePlus },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-ink text-paper flex flex-col relative">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 divider-barcode opacity-40" />
      <div className="px-6 pt-8 pb-6">
        <div className="font-display text-2xl font-700 tracking-tight">
          STOKKU
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-wheat/70 mt-1">
          Manajemen Stok Barang
        </div>
      </div>

      <div className="divider-barcode text-paper mx-6" />

      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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

      <div className="px-6 py-5 text-[11px] text-wheat/50 font-mono">
        v1.0 — lokal &amp; tanpa server
      </div>
    </aside>
  );
}
