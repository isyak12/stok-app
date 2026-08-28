"use client";

// ============================================================
// Halaman: Ubah Password (v2 — tampilan lebih rapi)
// Ganti isi app/(dashboard)/akun/ubah-password/page.tsx dengan ini.
// ============================================================

import UbahPasswordForm from "@/components/UbahPasswordForm";

export default function UbahPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ubah Password</h1>
        <p className="text-sm text-gray-500 mt-1">
          Masukkan password Anda saat ini, lalu password baru yang ingin
          digunakan.
        </p>
      </div>
      <UbahPasswordForm />
    </div>
  );
}
