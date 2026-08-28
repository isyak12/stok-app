"use client";

// ============================================================
// Halaman: Ubah Password (v3 — konsisten dengan identitas visual
// STOK-SKYNET: font-display untuk judul, mengikuti pola Sidebar)
// Ganti isi app/(dashboard)/akun/ubah-password/page.tsx dengan ini.
// ============================================================

import UbahPasswordForm from "@/components/UbahPasswordForm";

export default function UbahPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-700 tracking-tight text-ink">
          Ubah Password
        </h1>
        <p className="text-sm text-ink/50 mt-1">
          Masukkan password Anda saat ini, lalu password baru yang ingin
          digunakan.
        </p>
      </div>
      <UbahPasswordForm />
    </div>
  );
}
