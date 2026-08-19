# Stokku — Aplikasi Manajemen Stok Barang

Aplikasi manajemen stok barang berbasis Next.js (App Router), TypeScript, dan Tailwind CSS.

## Fitur

- **Dasbor**: ringkasan jumlah jenis barang, total unit, estimasi nilai stok, dan daftar barang dengan stok di bawah batas minimum.
- **Daftar Stok**: tabel semua barang dengan pencarian (nama/SKU) dan filter kategori.
- **Tambah Barang**: form untuk mencatat barang baru (SKU, kategori, jumlah, satuan, stok minimum, harga beli/jual, lokasi).
- **Ubah / Hapus Barang**: edit detail barang atau hapus dari daftar.
- Data disimpan di **Supabase** (PostgreSQL), lewat dua tabel: `produk` (data master barang) dan `stok` (jumlah & lokasi persediaan).

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).
2. Buka **SQL Editor** di dashboard project, lalu jalankan isi `supabase/schema.sql` untuk membuat tabel `produk` dan `stok`.
3. (Opsional) Jalankan juga `supabase/seed.sql` untuk mengisi 5 data contoh, biar Dasbor & Daftar Stok langsung terisi.
4. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.
5. Salin `.env.local.example` menjadi `.env.local`, lalu isi dua nilai tersebut:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

> **Catatan keamanan**: policy RLS di `schema.sql` mengizinkan semua akses baca/tulis lewat anon key, supaya mudah dipakai untuk mulai/prototipe. Sebelum dipakai produksi (apalagi kalau nanti multi-user), tambahkan autentikasi dan ganti policy `using (true)` dengan pengecekan `auth.uid()`.

## Menjalankan secara lokal

Pastikan Node.js 18+ terpasang, lalu jalankan:

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Deploy (mis. ke Vercel)

Saat deploy, tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sebagai environment variables di dashboard hosting Anda — file `.env.local` tidak ikut ter-upload (sengaja di-ignore lewat `.gitignore`).

## Struktur Proyek

```
app/
  page.tsx              → Dasbor
  stok/page.tsx          → Daftar stok
  stok/tambah/page.tsx  → Form tambah barang
  stok/[id]/page.tsx     → Form ubah barang
  layout.tsx             → Layout + sidebar
  globals.css            → Style global & token warna/font
components/
  Sidebar.tsx
  StokTable.tsx
  StokForm.tsx
  StatCard.tsx
lib/
  types.ts     → Tipe data Barang (gabungan produk + stok untuk UI)
  supabase.ts  → Klien Supabase
  storage.ts   → Hook useStok() — baca/tulis ke Supabase
supabase/
  schema.sql   → Definisi tabel produk & stok + RLS
  seed.sql     → Data contoh (opsional)
```

## Langkah lanjutan yang mungkin berguna

- Tambah autentikasi (mis. Supabase Auth) bila stok perlu dibatasi per pengguna/toko, lalu perketat policy RLS.
- Tambah tabel `mutasi_stok` untuk mencatat riwayat barang masuk/keluar bila perlu jejak audit.
- Aktifkan Supabase Realtime pada tabel `stok` bila ingin Dasbor/Daftar Stok update otomatis tanpa refresh saat diubah dari perangkat lain.
