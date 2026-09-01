# STOK-SKYNET — Aplikasi Manajemen Stok Barang Multi-Cabang

Aplikasi manajemen stok barang berbasis Next.js (App Router), TypeScript, dan Tailwind CSS, dengan dukungan multi-cabang, transfer antar cabang, stok opname, dan kontrol akses berjenjang (superadmin/admin/staf). Data disimpan di **Supabase** (PostgreSQL + Auth + Storage).

## Fitur

### Dasbor
- Ringkasan jumlah jenis barang, total unit, estimasi nilai stok (berdasarkan harga beli), dan jumlah baris stok yang di bawah batas minimum.
- Filter tampilan per **cabang** atau gabungan semua cabang — statistik dan daftar "stok menipis" dihitung ulang sesuai cabang yang dipilih.

### Daftar Stok & Data Barang
- Tabel semua barang dengan pencarian (nama/SKU) dan filter kategori.
- Tambah barang baru (SKU, kategori, satuan, stok minimum, harga beli/jual, lokasi) sekaligus memilih cabang tempat stok awalnya dicatat.
- Ubah detail barang per cabang (jumlah, stok minimum, lokasi bisa berbeda tiap cabang untuk produk yang sama) dan hapus barang dari daftar.
- Indikator stok rendah dihitung **per baris cabang**, bukan cuma dari total gabungan — supaya cabang yang kritis tetap terlihat walau stok cabang lain masih aman.

### Multi-Cabang
- Data cabang (`cabang`) dengan kode dan nama sendiri; satu produk bisa punya baris stok berbeda di tiap cabang.
- **Transfer Stok** antar cabang: cabang asal mencatat pengiriman (**wajib unggah foto bukti sebelum kirim**), cabang tujuan **mengonfirmasi penerimaan** (wajib unggah foto bukti tersendiri) sebelum stok tujuan bertambah — status berjalan dari *Terkirim* → *Diterima*, atau bisa **dibatalkan/ditolak** selama masih *Terkirim* (dengan alasan). Riwayat transfer menampilkan foto bukti kirim dan bukti terima secara terpisah.
- Riwayat transfer punya **pencarian** (catatan, dikirim/diterima oleh, nama cabang) dan **filter** status (Terkirim/Diterima/Dibatalkan) serta cabang.
- Notifikasi lonceng di sidebar untuk transfer yang **masuk dan masih menunggu konfirmasi** di cabang pengguna, diperbarui otomatis lewat Supabase Realtime.

### Transaksi Stok (Masuk/Keluar)
- Catat barang masuk/keluar per cabang sebagai jejak audit; jumlah stok di tabel `stok` diperbarui otomatis lewat trigger database.
- Wajib melampirkan minimal satu foto/dokumen bukti transaksi (disimpan di Supabase Storage), dengan catatan, pihak terkait, dan nomor referensi opsional; tanggal transaksi bisa diatur manual.
- Transaksi bisa **dibatalkan (void)** kalau salah catat — baris tetap tampil di riwayat (bukan dihapus) dan ditandai dibatalkan beserta alasannya, supaya jejak audit tetap utuh.
- Riwayat transaksi punya **pencarian** (pihak, no. referensi, catatan, nama cabang) dan **filter** tipe (Masuk/Keluar) serta cabang.

### Stok Opname (Rekonsiliasi Fisik)
- Bandingkan stok sistem vs. hasil hitung fisik per produk & cabang; selisih otomatis dihitung dan (bila ada selisih) langsung menyesuaikan stok lewat transaksi penyesuaian.
- Alasan selisih (rusak/hilang/salah catat/lainnya) plus catatan bebas; **wajib unggah foto bukti kalau ada selisih**, opsional kalau stok cocok.
- Riwayat opname punya **pencarian** (alasan, catatan, dicatat oleh, nama cabang) dan **filter** hasil selisih (Cocok/Lebih/Kurang) serta cabang.

### Riwayat Mutasi
- Linimasa gabungan per barang yang menyatukan transaksi masuk/keluar dan transfer antar cabang dalam satu tampilan terurut waktu, termasuk status transfer dan status pembatalan.

### Log Aktivitas Barang
- Jejak audit otomatis (lewat trigger database) untuk barang ditambahkan, stok berkurang, dan barang dihapus — mencatat siapa, kapan, produk/cabang mana, dan jumlahnya. Hanya bisa diakses admin/superadmin.

### Kenyamanan Form
- Form Transaksi Stok, Transfer Stok, dan Stok Opname otomatis menyimpan draft isian ke penyimpanan lokal perangkat selagi diketik — kalau koneksi putus atau tab tertutup tidak sengaja, isian bisa dipulihkan saat form dibuka lagi.

### Login & Peran Pengguna
- Login berbasis username + kata sandi (memakai Supabase Auth di baliknya; username diterjemahkan ke email internal). Tidak ada halaman daftar akun sendiri.
- Tiga peran berjenjang:
  - **Staf Gudang** — operasional harian (stok, transaksi, transfer, opname) sesuai hak akses yang diizinkan.
  - **Admin** — semua hak staf, ditambah Tambah Barang dan Log Aktivitas.
  - **Superadmin** — semua hak admin, ditambah halaman **Kelola Pengguna** (buat akun baru, ubah peran admin/staf, hapus akun, **reset password akun lain**) lewat `app/api/pengguna` yang memakai Supabase service role key. Reset password tidak bisa dipakai untuk akun sendiri (harus lewat halaman Ubah Password) maupun untuk akun superadmin lain — mencegah satu superadmin mengambil alih akun superadmin lain diam-diam.
- Halaman **Ubah Password** untuk mengganti kata sandi akun sendiri.
- Middleware me-refresh sesi login di setiap request dan mengarahkan ke `/login` bila belum login.

### Data
Disimpan di **Supabase** (PostgreSQL) lewat beberapa tabel utama: `produk` (data master barang), `stok` (jumlah & lokasi per produk per cabang), `cabang` (daftar cabang), `transaksi_stok` (riwayat masuk/keluar), `transfer_stok` (riwayat transfer antar cabang), `stok_opname` (riwayat rekonsiliasi fisik), dan `log_aktivitas_barang` (jejak audit barang). File bukti/foto disimpan di Supabase Storage.

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).

2. Buka **SQL Editor** di dashboard project, lalu jalankan file-file di `supabase/` **PERSIS SESUAI URUTAN INI** (masing-masing membangun di atas yang sebelumnya — banyak file men-drop & menulis ulang function dari file sebelumnya, jadi urutan ini bukan sekadar saran):
   1. `schema.sql` — tabel `produk` dan `stok` + RLS awal.
   2. `role-policies.sql` — kebijakan akses berbasis peran admin/staf.
   3. `auth-policies.sql` — memperketat akses supaya hanya user login yang bisa membaca/mengubah data.
   4. `transaksi_stok.sql` — tabel `transaksi_stok` + trigger otomatis update stok.
   5. `migrasi_cabang.sql` — dukungan multi-cabang (tabel `cabang`, kolom `cabang_id` di `stok`).
   6. `migrasi_transaksi_cabang.sql` — kolom `cabang_id` di `transaksi_stok`.
   7. `transfer_stok.sql`, `migrasi_realtime_transfer.sql` — fitur Transfer Stok antar cabang + notifikasi realtime.
   8. `mutasi_detail.sql` — kolom detail (pencatat, pihak, no. referensi) + alur Terkirim→Diterima pada transfer. **Wajib di sini** (bukan di akhir) karena banyak file berikutnya butuh function `konfirmasi_terima_transfer` dan kolom `transaksi_stok.dibuat_oleh` dari file ini sudah ada.
   9. `pembatalan_transaksi.sql` — pembatalan (void) transaksi stok.
   10. `pembatalan_transfer.sql`, `migrasi_batal_transfer.sql` — pembatalan transfer stok.
   11. `stok_opname.sql` — fitur Stok Opname (rekonsiliasi fisik).
   12. `migrasi_kunci_stok_minimum.sql`, `migrasi_kunci_jumlah_manual.sql` — kunci kolom stok tertentu supaya tidak diubah langsung di luar alur transaksi resmi. Sejak diperbaiki (2026-09), `migrasi_kunci_jumlah_manual.sql` sudah menulis ulang `catat_transfer_stok`, `konfirmasi_terima_transfer`, dan `catat_stok_opname` pakai signature **final** (termasuk parameter bukti foto) — jadi file ini sekarang **aman dijalankan ulang kapan saja / urutan berapa saja** terhadap langkah 16–18, tidak lagi jadi jebakan kalau dijalankan lagi belakangan.
   13. `migrasi_tanggal_manual_transaksi.sql` — izinkan atur tanggal transaksi manual.
   14. `migrasi_bukti_transaksi_stok.sql`, `fix_rls_transaksi_stok_lampiran.sql` — wajib lampiran bukti transaksi.
   15. `migrasi_auto_baris_stok_transaksi.sql` — otomatis buat baris stok saat transaksi pertama di suatu cabang.
   16. `migrasi_bukti_penerimaan.sql`, `fix_kunci_bukti_penerimaan.sql` — wajib bukti foto saat konfirmasi terima transfer.
   17. `migrasi_bukti_pengiriman.sql` — wajib bukti foto sebelum barang dikirim saat mencatat transfer (pakai bucket Storage yang sama dengan langkah 16).
   18. `migrasi_bukti_opname.sql`, `migrasi_wajib_bukti_opname_selisih.sql` — bukti foto pada Stok Opname (opsional, wajib kalau ada selisih).
   19. `migrasi_log_aktivitas_barang.sql` — tabel & trigger Log Aktivitas Barang.
   20. `migrasi_superadmin.sql`, `migrasi_perbaikan_peran.sql` — peran `superadmin` dan sumber peran dari `app_metadata`.

   File `fix_*.sql` adalah perbaikan yang sudah digabung ke migrasi terkait — jalankan untuk kelengkapan histori, tidak wajib dipisah.

   > **Kenapa urutan ini penting?** Setiap file `.sql` di atas punya komentar header yang menyatakan prasyaratnya sendiri (mis. "SETELAH mutasi_detail.sql"). Urutan di atas disusun mengikuti prasyarat tersebut secara konsisten. Untuk **setup database baru dari nol**, tetap ikuti urutan ini. Untuk database yang **sudah berjalan**: `migrasi_kunci_jumlah_manual.sql` (langkah 12) sekarang aman dijalankan ulang kapan saja tanpa memandang urutan terhadap langkah 16–18, jadi kalau butuh me-replay migrasi di database yang sudah ada, tidak perlu lagi khawatir soal urutan spesifik untuk file itu — cukup pastikan file lain tetap mengikuti prasyaratnya masing-masing.

3. (Opsional) Jalankan `supabase/seed.sql` dan `supabase/seed_mutasi.sql` untuk mengisi data contoh, biar Dasbor & Daftar Stok langsung terisi.

4. Di **Storage**, buat bucket publik untuk lampiran (transaksi, penerimaan transfer, dan opname) sesuai nama bucket yang dipakai di `lib/lampiran-upload.ts`.

5. Buka **Project Settings > API**, salin **Project URL**, **anon public key**, dan **service_role key**.

6. Salin `.env.local.example` menjadi `.env.local`, lalu isi tiga nilai tersebut:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> `SUPABASE_SERVICE_ROLE_KEY` **wajib** diisi untuk fitur Kelola Pengguna (`app/api/pengguna`). Kunci ini bisa bypass RLS sepenuhnya — jangan pernah diberi prefix `NEXT_PUBLIC_` atau dipakai di kode client.

## Setup Login & Peran Pengguna (Supabase Auth)

Aplikasi ini **tidak punya halaman daftar akun sendiri**. Akun pertama (superadmin) dibuat manual lewat dashboard Supabase; setelahnya akun lain bisa dibuat lewat halaman **Kelola Pengguna** di aplikasi.

1. Di dashboard Supabase, buka **Authentication > Users** → **Add user** → **Create new user**. Isi email dan kata sandi untuk user pertama, centang **Auto Confirm User**.
2. Buka **Authentication > Sign In / Providers > Email**, matikan **Allow new users to sign up** — supaya orang lain tidak bisa mendaftar sendiri lewat aplikasi.
3. Jadikan user pertama **superadmin**: di **SQL Editor**, jalankan `supabase/set-peran-user.sql` (atau update `app_metadata` user tersebut secara manual) untuk mengatur `peran: "superadmin"`. Peran dibaca dari `app_metadata` (bukan `user_metadata`) supaya tidak bisa dinaikkan sendiri oleh user lewat client SDK.
4. Jalankan `npm install`, lalu `npm run dev`. Buka `http://localhost:3000` — akan otomatis diarahkan ke `/login`, lalu login dengan **username** (bagian sebelum `@` dari email yang dibuat).
5. Untuk menambah user berikutnya (admin/staf), gunakan halaman **Kelola Pengguna** di sidebar (khusus superadmin) — tidak perlu lagi lewat dashboard Supabase.

> **Catatan**: sebelum `auth-policies.sql` dan `role-policies.sql` dijalankan, akses tabel masih longgar lewat anon key. Pastikan seluruh migrasi di atas dijalankan sebelum aplikasi dipakai sungguhan.

## Menjalankan secara lokal

Pastikan Node.js 18+ terpasang, lalu jalankan:

```
npm install
npm run dev
```

Buka <http://localhost:3000> di browser.

## Deploy (mis. ke Vercel)

Saat deploy, tambahkan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` sebagai environment variables di dashboard hosting Anda — file `.env.local` tidak ikut ter-upload (sengaja di-ignore lewat `.gitignore`).

## Struktur Proyek

```
app/
  login/page.tsx                          → Halaman login (username + kata sandi)
  layout.tsx, globals.css                 → Layout root & style global/token warna/font
  (dashboard)/layout.tsx                  → Layout + sidebar (cek login di server)
  (dashboard)/page.tsx                    → Dasbor (ringkasan + filter per cabang)
  (dashboard)/stok/page.tsx               → Daftar stok
  (dashboard)/stok/tambah/page.tsx        → Form tambah barang
  (dashboard)/stok/[id]/page.tsx          → Form ubah barang (per cabang)
  (dashboard)/stok/[id]/transaksi/page.tsx→ Catat & lihat transaksi masuk/keluar
  (dashboard)/stok/[id]/transfer/page.tsx → Transfer stok antar cabang
  (dashboard)/stok/[id]/opname/page.tsx   → Stok opname (rekonsiliasi fisik)
  (dashboard)/stok/[id]/riwayat/page.tsx  → Riwayat mutasi gabungan per barang
  (dashboard)/log-aktivitas/page.tsx      → Log Aktivitas Barang (admin/superadmin)
  (dashboard)/pengguna/page.tsx           → Kelola Pengguna (superadmin)
  (dashboard)/akun/ubah-password/page.tsx → Ubah password akun sendiri
  api/pengguna/route.ts                   → API CRUD akun (pakai service role key)
middleware.ts                             → Refresh sesi login & redirect ke /login
components/
  Sidebar.tsx                → Navigasi (menyesuaikan peran) + info user + keluar
  NotifikasiTransferMasuk.tsx→ Lonceng notifikasi transfer masuk (realtime)
  StokTable.tsx / StokForm.tsx           → Daftar & form barang
  TransaksiStokTable.tsx / TransaksiStokForm.tsx → Transaksi masuk/keluar
  TransferStokTable.tsx / TransferStokForm.tsx   → Transfer antar cabang
  StokOpnameTable.tsx / StokOpnameForm.tsx       → Stok opname
  RiwayatMutasiTable.tsx     → Tabel riwayat mutasi gabungan
  LampiranFoto.tsx           → Unggah & pratinjau lampiran foto/dokumen
  UbahPasswordForm.tsx       → Form ubah password
  StatCard.tsx                → Kartu statistik di Dasbor
lib/
  types.ts               → Semua tipe data (Barang, TransaksiStok, TransferStok, StokOpname, dll.)
  role.ts                 → Peran (superadmin/admin/staf) & helper hak akses
  username.ts             → Konversi username <-> email internal
  lampiran-upload.ts      → Upload lampiran ke Supabase Storage (dengan rollback)
  error.ts                 → pesanError() — ekstrak pesan error yang aman ditampilkan ke user,
                              termasuk error dari Supabase (bukan instance Error bawaan JS)
  useFormDraft.ts          → Hook auto-save draft form (localStorage) supaya isian panjang di
                              form Transaksi/Transfer/Opname tidak hilang saat koneksi putus
                              atau tab tertutup tidak sengaja
  useUser.ts               → Hook data user & peran yang sedang login
  storage.ts               → Semua hook data: useStok, useCabang, useTransaksiStok,
                              useTransferStok, useStokOpname, useRiwayatMutasi,
                              useLogAktivitasBarang, useTransferMenunggu, dll.
  supabase/client.ts, server.ts → Klien Supabase untuk client/server component
  supabase/admin.ts        → Klien service role (server-only, untuk API Kelola Pengguna)
supabase/
  schema.sql, role-policies.sql, auth-policies.sql → Skema dasar & RLS
  migrasi_cabang.sql, migrasi_transaksi_cabang.sql, ... → Dukungan multi-cabang
  transaksi_stok.sql, pembatalan_transaksi.sql, migrasi_bukti_transaksi_stok.sql → Transaksi stok
  transfer_stok.sql, migrasi_realtime_transfer.sql, pembatalan_transfer.sql, migrasi_bukti_penerimaan.sql, migrasi_bukti_pengiriman.sql → Transfer stok
  stok_opname.sql, migrasi_bukti_opname.sql, migrasi_wajib_bukti_opname_selisih.sql → Stok opname
  migrasi_log_aktivitas_barang.sql → Log Aktivitas Barang
  migrasi_superadmin.sql, migrasi_perbaikan_peran.sql → Peran superadmin
  seed.sql, seed_mutasi.sql → Data contoh (opsional)
```

## Langkah lanjutan yang mungkin berguna

- Tambah filter tanggal & export (PDF/Excel) di halaman Riwayat Mutasi dan Log Aktivitas untuk kebutuhan laporan bulanan.
- Tambah laporan lintas cabang (mis. rekap nilai stok atau transfer per periode) di luar tampilan per-barang yang ada saat ini.
- Pertimbangkan notifikasi lain selain transfer masuk (mis. stok yang baru menyentuh batas minimum) memakai jalur Realtime yang sama.
