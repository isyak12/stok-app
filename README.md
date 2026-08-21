# Stokku — Aplikasi Manajemen Stok Barang

Aplikasi manajemen stok barang multi-cabang berbasis Next.js (App Router), TypeScript, Tailwind CSS, dan Supabase (PostgreSQL + Auth).

Demo: [stok-app-fawn.vercel.app](https://stok-app-fawn.vercel.app)

## Fitur

- **Dasbor**: ringkasan jumlah jenis barang, total unit, estimasi nilai stok, dan daftar barang dengan stok di bawah batas minimum.
- **Daftar Stok**: tabel semua barang dengan pencarian (nama/SKU) dan filter kategori.
- **Tambah Barang** *(khusus admin)*: form untuk mencatat barang baru (SKU, kategori, cabang, jumlah, satuan, stok minimum, harga beli/jual, lokasi).
- **Ubah Barang**: edit detail barang. Staf gudang bisa memperbarui jumlah/lokasi/stok minimum; SKU, nama, kategori, dan harga hanya bisa diubah admin.
- **Hapus Barang** *(khusus admin)*.
- **Transaksi Stok**: catat barang masuk/keluar per cabang, lengkap dengan riwayat dan opsi pembatalan transaksi.
- **Transfer Stok**: pindahkan stok antar cabang (kirim → konfirmasi diterima), dengan opsi pembatalan selama transfer masih berstatus "terkirim".
- **Stok Opname**: rekonsiliasi stok fisik vs stok sistem per cabang. Kalau ada selisih, sistem otomatis membuat transaksi penyesuaian dan menyesuaikan stok cabang tersebut.
- **Riwayat Mutasi**: linimasa gabungan semua pergerakan stok satu barang (transaksi + transfer), terurut dari yang terbaru.
- **Multi-Cabang**: setiap barang bisa punya baris stok berbeda di tiap cabang (jumlah, stok minimum, lokasi masing-masing).
- **Role & Akses**: dua peran pengguna — **admin** (akses penuh) dan **staf gudang** (akses terbatas ke pergerakan stok, tidak bisa tambah/hapus barang atau ubah data master/harga). Lihat bagian [Role & Akses](#role--akses).
- **Login**: hanya user yang terdaftar yang bisa membuka dan mengubah data (Supabase Auth, login pakai username + kata sandi — di balik layar tetap email, lihat `lib/username.ts`).
- Data disimpan di **Supabase** (PostgreSQL), lewat tabel `produk` (data master barang), `stok` (jumlah & lokasi per cabang), `cabang`, `transaksi_stok`, `transfer_stok`, dan `stok_opname`.

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).
2. Buka **SQL Editor** di dashboard project, lalu jalankan file-file berikut **berturut-turut sesuai urutan** (saling bergantung satu sama lain):

   | # | File | Fungsi |
   |---|------|--------|
   | 1 | `supabase/schema.sql` | Tabel `produk` dan `stok` + RLS awal (masih terbuka lewat anon key). |
   | 2 | `supabase/transaksi_stok.sql` | Tabel `transaksi_stok` + function `catat_transaksi_stok`. |
   | 3 | `supabase/migrasi_cabang.sql` | Tabel `cabang`, tambah kolom `cabang_id` di `stok`, sesuaikan function transaksi supaya mendukung multi-cabang. **Wajib** — tanpa ini dropdown Cabang & form tambah/ubah barang tidak berfungsi. |
   | 4 | `supabase/migrasi_transaksi_cabang.sql` | Penyesuaian lanjutan `catat_transaksi_stok` untuk skenario cabang. |
   | 5 | `supabase/transfer_stok.sql` | Tabel `transfer_stok` + function `catat_transfer_stok` (transfer antar cabang, status `terkirim`). |
   | 6 | `supabase/mutasi_detail.sql` | Penyempurnaan `catat_transaksi_stok`, `catat_transfer_stok`, dan function baru `konfirmasi_terima_transfer` (stok tujuan baru bertambah setelah dikonfirmasi diterima). |
   | 7 | `supabase/pembatalan_transaksi.sql` | Function `batalkan_transaksi_stok` — batalkan transaksi & kembalikan stok. |
   | 8 | `supabase/pembatalan_transfer.sql` | Function `batalkan_transfer_stok` — batalkan transfer yang masih `terkirim`. |
   | 9 | `supabase/migrasi_batal_transfer.sql` | Penyesuaian tambahan terkait pembatalan transfer. |
   | 10 | `supabase/stok_opname.sql` | Tabel `stok_opname` + function `catat_stok_opname` (rekonsiliasi fisik, otomatis catat penyesuaian kalau ada selisih). |

3. (Opsional) Jalankan `supabase/seed.sql` untuk mengisi beberapa data contoh, biar Dasbor & Daftar Stok langsung terisi.
4. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.
5. Salin `.env.local.example` menjadi `.env.local`, lalu isi dua nilai tersebut:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

## Setup Login (Supabase Auth)

Aplikasi ini **tidak punya halaman daftar akun sendiri** — akun dibuat manual oleh admin lewat dashboard Supabase, supaya tidak sembarang orang bisa mendaftar.

1. Di dashboard Supabase, buka **Authentication > Users** → klik **Add user** → **Create new user**.
2. Isi email dan kata sandi untuk user pertama (misalnya kamu sendiri). Karena login di aplikasi pakai **username**, bukan email asli, gunakan pola `username@stokku.local` sebagai email (lihat `lib/username.ts` untuk domain internalnya). Centang **Auto Confirm User** supaya tidak perlu verifikasi email.
3. Buka **Authentication > Sign In / Providers > Email**, matikan opsi **Allow new users to sign up** — supaya orang lain tidak bisa mendaftar sendiri lewat aplikasi.
4. Kembali ke **SQL Editor**, jalankan `supabase/auth-policies.sql` untuk memperketat akses tabel `produk`, `stok`, `transaksi_stok`, `cabang`, dan `transfer_stok` — hanya user yang login yang bisa membaca/mengubah data.
5. Jalankan `supabase/role-policies.sql` untuk mengaktifkan pembatasan peran admin/staf (lihat [Role & Akses](#role--akses) di bawah).
6. Jalankan `npm install` (menambahkan paket `@supabase/ssr`), lalu `npm run dev`. Buka `http://localhost:3000` — akan otomatis diarahkan ke `/login`.

Untuk menambah user baru (misalnya rekan kerja), ulangi langkah 1–2 di atas kapan saja lewat dashboard Supabase, lalu set perannya (lihat bawah).

> **Catatan**: sebelum menjalankan `auth-policies.sql`, akses tabel masih terbuka lewat anon key (policy dari `schema.sql`). Wajar untuk tahap awal/prototipe, tapi pastikan dijalankan sebelum aplikasi dipakai sungguhan.

## Role & Akses

Ada dua peran:

| | Admin | Staf Gudang |
|---|---|---|
| Lihat Dasbor, Daftar Stok, Riwayat Mutasi | ✅ | ✅ |
| Transaksi Stok, Transfer Stok, Stok Opname | ✅ | ✅ |
| Ubah jumlah / lokasi / stok minimum | ✅ | ✅ |
| Tambah barang baru | ✅ | ❌ |
| Hapus barang | ✅ | ❌ |
| Ubah SKU / nama / kategori / harga beli / harga jual | ✅ | ❌ |

Peran disimpan di **user metadata** akun Supabase Auth (`raw_user_meta_data.peran`), bukan di tabel terpisah — jadi tidak perlu tabel `users` tambahan. User yang belum punya field `peran` otomatis dianggap **staf** (default paling aman).

**Cara mengaktifkan:**

1. Jalankan `supabase/role-policies.sql` di SQL Editor (setelah `auth-policies.sql`). File ini menambahkan:
   - Function `peran_saya()` — baca peran dari token login yang sedang aktif.
   - Policy RLS: hanya admin yang boleh **INSERT**/**DELETE** ke tabel `produk`.
   - Trigger `trg_cegah_staf_ubah_produk` — kalau staf mencoba mengubah nama/SKU/kategori/harga lewat form Ubah Barang, perubahan itu **ditolak di level database**, apa pun yang dikirim dari browser.
2. Buat/atur user seperti biasa lewat **Authentication > Users**.
3. Set peran user lewat SQL Editor:

   ```sql
   update auth.users
   set raw_user_meta_data = raw_user_meta_data || '{"peran": "admin"}'::jsonb
   where email = 'superadmin@stokku.local';

   update auth.users
   set raw_user_meta_data = raw_user_meta_data || '{"peran": "staf"}'::jsonb
   where email = 'staff@stokku.local';
   ```

   Contoh siap-pakai ada di `supabase/set-peran-user.sql`.

4. User yang sedang login perlu **logout lalu login lagi** setelah perannya diubah, supaya token JWT membawa metadata `peran` yang terbaru.

> Pembatasan di sisi tampilan (tombol disembunyikan/dinonaktifkan untuk staf) hanya untuk kenyamanan. Yang benar-benar menegakkan aturan akses adalah RLS policy + trigger di database — jadi tetap aman meski seseorang mencoba memanggil Supabase API langsung dari luar aplikasi.

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
  login/page.tsx                       → Halaman login
  (dashboard)/layout.tsx                → Layout + sidebar (cek login & peran di server)
  (dashboard)/page.tsx                  → Dasbor
  (dashboard)/stok/page.tsx             → Daftar stok
  (dashboard)/stok/tambah/page.tsx      → Form tambah barang (khusus admin)
  (dashboard)/stok/[id]/page.tsx        → Form ubah barang
  (dashboard)/stok/[id]/transaksi/page.tsx → Transaksi stok masuk/keluar
  (dashboard)/stok/[id]/transfer/page.tsx  → Transfer stok antar cabang
  (dashboard)/stok/[id]/opname/page.tsx    → Stok opname (rekonsiliasi fisik)
  (dashboard)/stok/[id]/riwayat/page.tsx   → Riwayat mutasi gabungan
  layout.tsx                            → Layout root (minimal)
  globals.css                           → Style global & token warna/font
middleware.ts                           → Refresh sesi login & redirect ke /login

components/
  Sidebar.tsx             → Navigasi + info user, peran, tombol keluar
  StokTable.tsx            → Tabel daftar stok (tombol Hapus disembunyikan untuk staf)
  StokForm.tsx              → Form tambah/ubah barang (field master terkunci untuk staf)
  StatCard.tsx
  TransaksiStokForm.tsx / TransaksiStokTable.tsx
  TransferStokForm.tsx / TransferStokTable.tsx
  StokOpnameForm.tsx / StokOpnameTable.tsx
  RiwayatMutasiTable.tsx

lib/
  types.ts               → Tipe data Barang, transaksi, transfer, opname, dll (gabungan produk + stok untuk UI)
  role.ts                 → Tipe Peran ("admin" | "staf") + helper baca peran dari user
  useUser.ts               → Hook client: user & peran yang sedang login
  username.ts              → Konversi username <-> email internal (@stokku.local)
  supabase/client.ts        → Klien Supabase untuk client component
  supabase/server.ts         → Klien Supabase untuk server component
  storage.ts                 → Hook-hook utama: useStok, useCabang, useTransaksiStok,
                                useTransferStok, useStokOpname, useRiwayatMutasi

supabase/
  schema.sql                    → Tabel produk & stok + RLS awal
  transaksi_stok.sql             → Tabel transaksi_stok + function catat_transaksi_stok
  migrasi_cabang.sql              → Tabel cabang + kolom stok.cabang_id (wajib)
  migrasi_transaksi_cabang.sql     → Penyesuaian transaksi untuk cabang
  transfer_stok.sql                 → Tabel transfer_stok + function catat_transfer_stok
  mutasi_detail.sql                  → Penyempurnaan transaksi/transfer + konfirmasi_terima_transfer
  pembatalan_transaksi.sql            → Function batalkan_transaksi_stok
  pembatalan_transfer.sql              → Function batalkan_transfer_stok
  migrasi_batal_transfer.sql            → Penyesuaian tambahan pembatalan transfer
  stok_opname.sql                        → Tabel stok_opname + function catat_stok_opname
  auth-policies.sql                       → Perketat RLS supaya wajib login
  role-policies.sql                        → Peran admin/staf: RLS + trigger pembatasan produk
  set-peran-user.sql                        → Contoh set peran beberapa user sekaligus
  seed.sql                                   → Data contoh (opsional)
```

## Langkah lanjutan yang mungkin berguna

- Notifikasi (email/WhatsApp) otomatis saat ada barang dengan stok di bawah minimum.
- Export riwayat mutasi & stok opname ke Excel/PDF untuk laporan berkala.
- Scan barcode/QR untuk input SKU saat transaksi atau stok opname, biar staf gudang tidak perlu ketik manual.
- Prediksi kebutuhan restock berdasarkan rata-rata pemakaian dari riwayat transaksi.
- Dashboard per cabang (filter Dasbor supaya bisa lihat kondisi satu cabang spesifik).
- Aktifkan Supabase Realtime pada tabel `stok` bila ingin Dasbor/Daftar Stok update otomatis tanpa refresh saat diubah dari perangkat/pengguna lain.
- Tambah peran lebih granular (mis. admin per-cabang) bila cabang makin banyak dan perlu penanggung jawab masing-masing.
