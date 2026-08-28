"use client";

// ============================================================
// Halaman: Ubah Password
// Taruh di app/(dashboard)/akun/ubah-password/page.tsx
// (sesuaikan lokasi kalau kamu sudah punya halaman "Akun"/"Pengaturan"
// sendiri -- tinggal pindahkan isi <UbahPasswordForm /> ke situ)
// ============================================================

import UbahPasswordForm from "@/components/UbahPasswordForm";

export default function UbahPasswordPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ubah Password</h1>
        <p className="text-sm text-gray-500">
          Masukkan password Anda saat ini, lalu password baru yang ingin
          digunakan.
        </p>
      </div>
      <UbahPasswordForm />
    </div>
  );
}
