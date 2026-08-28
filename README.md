# Stokku — Aplikasi Manajemen Stok Barang

Aplikasi manajemen stok barang berbasis Next.js (App Router), TypeScript, dan Tailwind CSS.

## Fitur

- **Dasbor**: ringkasan jumlah jenis barang, total unit, estimasi nilai stok, dan daftar barang dengan stok di bawah batas minimum.
- **Daftar Stok**: tabel semua barang dengan pencarian (nama/SKU) dan filter kategori.
- **Tambah Barang**: form untuk mencatat barang baru (SKU, kategori, jumlah, satuan, stok minimum, harga beli/jual, lokasi).
- **Ubah / Hapus Barang**: edit detail barang atau hapus dari daftar.
- **Riwayat Mutasi Stok**: catat setiap barang masuk/keluar sebagai jejak audit; jumlah stok di tabel `stok` diperbarui otomatis lewat trigger database, dan riwayat tidak bisa diubah/dihapus dari aplikasi.
- **Login**: hanya user yang terdaftar yang bisa membuka dan mengubah data (Supabase Auth, email + kata sandi).
- Data disimpan di **Supabase** (PostgreSQL), lewat tiga tabel: `produk` (data master barang), `stok` (jumlah & lokasi persediaan), dan `mutasi_stok` (riwayat transaksi masuk/keluar).

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).

2. Buka **SQL Editor** di dashboard project, lalu jalankan berurutan:
   - `supabase/schema.sql` — membuat tabel `produk` dan `stok`.
   - `supabase/mutasi_stok.sql` — membuat tabel `mutasi_stok`, trigger otomatis update stok, dan RLS-nya.

3. (Opsional) Jalankan juga `supabase/seed.sql` untuk mengisi 5 data contoh, biar Dasbor & Daftar Stok langsung terisi. Lihat juga `supabase/seed_mutasi.sql` untuk contoh data riwayat mutasi.

4. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.

5. Salin `.env.local.example` menjadi `.env.local`, lalu isi dua nilai tersebut:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## Setup Login (Supabase Auth)

Aplikasi ini **tidak punya halaman daftar akun sendiri** — akun dibuat manual oleh admin lewat dashboard Supabase, supaya tidak sembarang orang bisa mendaftar.

1. Di dashboard Supabase, buka **Authentication > Users** → klik **Add user** → **Create new user**.
2. Isi email dan kata sandi untuk user pertama (misalnya kamu sendiri), lalu centang **Auto Confirm User** supaya tidak perlu verifikasi email.
3. Buka **Authentication > Sign In / Providers > Email**, matikan opsi **Allow new users to sign up** — supaya orang lain tidak bisa mendaftar sendiri lewat aplikasi.
4. Kembali ke **SQL Editor**, jalankan `supabase/auth-policies.sql` untuk memperketat akses tabel `produk` dan `stok` — hanya user yang login yang bisa membaca/mengubah data. Tabel `mutasi_stok` sudah otomatis dibatasi untuk user login lewat policy di `mutasi_stok.sql`.
5. Jalankan `npm install` (menambahkan paket `@supabase/ssr`), lalu `npm run dev`. Buka `http://localhost:3000` — akan otomatis diarahkan ke `/login`.

Untuk menambah user baru (misalnya rekan kerja), ulangi langkah 1–2 di atas kapan saja lewat dashboard Supabase.

> **Catatan**: sebelum menjalankan `auth-policies.sql`, akses tabel masih terbuka lewat anon key (policy dari `schema.sql`). Wajar untuk tahap awal, tapi pastikan dijalankan sebelum aplikasi dipakai sungguhan.

## Menjalankan secara lokal

Pastikan Node.js 18+ terpasang, lalu jalankan:

```
npm install
npm run dev
```

Buka <http://localhost:3000> di browser.

## Deploy (mis. ke Vercel)

Saat deploy, tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sebagai environment variables di dashboard hosting Anda — file `.env.local` tidak ikut ter-upload (sengaja di-ignore lewat `.gitignore`).

## Struktur Proyek

```
app/
  login/page.tsx              → Halaman login
  (dashboard)/layout.tsx       → Layout + sidebar (cek login di server)
  (dashboard)/page.tsx         → Dasbor
  (dashboard)/stok/page.tsx    → Daftar stok
  (dashboard)/stok/tambah/page.tsx  → Form tambah barang
  (dashboard)/stok/[id]/page.tsx    → Form ubah barang
  (dashboard)/stok/mutasi/page.tsx        → Riwayat mutasi stok
  (dashboard)/stok/mutasi/tambah/page.tsx → Form catat mutasi baru
  layout.tsx                   → Layout root (minimal)
  globals.css                  → Style global & token warna/font
middleware.ts                  → Refresh sesi login & redirect ke /login
components/
  Sidebar.tsx   → Navigasi + info user + tombol keluar
  StokTable.tsx
  StokForm.tsx
  StatCard.tsx
  MutasiTable.tsx  → Tabel riwayat mutasi stok
  MutasiForm.tsx   → Form catat mutasi masuk/keluar
lib/
  types.ts            → Tipe data Barang & MutasiStok (gabungan produk + stok untuk UI)
  supabase/client.ts  → Klien Supabase untuk client component
  supabase/server.ts  → Klien Supabase untuk server component
  storage.ts          → Hook useStok() — baca/tulis ke Supabase
  useMutasiStok.ts    → Hook useMutasiStok() — baca riwayat & catat mutasi baru
supabase/
  schema.sql        → Definisi tabel produk & stok + RLS awal
  auth-policies.sql → Perketat RLS supaya wajib login
  mutasi_stok.sql   → Tabel mutasi_stok + trigger otomatis update stok + RLS
  seed.sql          → Data contoh (opsional)
  seed_mutasi.sql   → Contoh data riwayat mutasi (opsional)
```

## Langkah lanjutan yang mungkin berguna

- Aktifkan Supabase Realtime pada tabel `stok` bila ingin Dasbor/Daftar Stok update otomatis tanpa refresh saat diubah dari perangkat lain.
- Tambah peran (role) pengguna (mis. admin vs staf gudang) bila nanti aksesnya perlu dibedakan per orang.
- Tambah filter tanggal & export (PDF/Excel) di halaman Riwayat Mutasi Stok untuk kebutuhan laporan bulanan.
