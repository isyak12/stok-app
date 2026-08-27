-- ============================================================
-- Migrasi: tambah peran "superadmin" di atas "admin".
--
-- Superadmin bisa melakukan SEMUA hal yang admin biasa bisa (kita
-- membuat saya_admin() mengembalikan true juga untuk superadmin, jadi
-- SEMUA policy & trigger lama yang sudah memanggil saya_admin() -- di
-- role-policies.sql, mutasi_detail.sql, dll -- otomatis berlaku juga
-- untuk superadmin TANPA perlu diubah satu per satu).
--
-- Kewenangan superadmin yang TIDAK dimiliki admin biasa: membuat akun
-- pengguna baru dan menentukan perannya (admin / staf). Ini ditegakkan
-- di sisi server Next.js (lihat app/api/pengguna/route.ts), bukan lewat
-- RLS -- karena operasi bikin akun (Supabase Auth Admin API) tidak
-- lewat tabel yang bisa dipasangi RLS.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- role-policies.sql dan migrasi_perbaikan_peran.sql.
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. peran_saya(): teruskan apa adanya nilai di app_metadata (bisa
--    'superadmin', 'admin', atau default 'staf'). Tidak berubah dari
--    migrasi_perbaikan_peran.sql selain menerima nilai baru.
-- ------------------------------------------------------------
create or replace function peran_saya()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'peran',
    'staf'
  );
$$;

-- ------------------------------------------------------------
-- 2. saya_admin(): sekarang true untuk 'admin' MAUPUN 'superadmin',
--    supaya semua policy/trigger lama yang sudah ada otomatis berlaku
--    juga untuk superadmin.
-- ------------------------------------------------------------
create or replace function saya_admin()
returns boolean
language sql
stable
as $$
  select peran_saya() in ('admin', 'superadmin');
$$;

-- ------------------------------------------------------------
-- 3. saya_superadmin(): helper baru untuk kewenangan yang KHUSUS
--    superadmin saja (dipakai kalau nanti perlu membatasi sesuatu di
--    level database juga, bukan cuma di route API).
-- ------------------------------------------------------------
create or replace function saya_superadmin()
returns boolean
language sql
stable
as $$
  select peran_saya() = 'superadmin';
$$;

-- ------------------------------------------------------------
-- 4. Naikkan akun superadmin@stokku.local (dibuat di set-peran-user.sql)
--    dari 'admin' menjadi 'superadmin'. Ganti email di bawah kalau
--    akun pertama Anda pakai username lain.
-- ------------------------------------------------------------
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"peran": "superadmin"}'::jsonb
where email = 'superadmin@stokku.local';

-- ============================================================
-- Catatan
-- ============================================================
-- - User yang SEDANG login perlu logout lalu login lagi supaya token
--   JWT membawa app_metadata "peran" terbaru.
-- - Untuk mengangkat superadmin TAMBAHAN (jarang perlu), jalankan
--   manual di SQL Editor:
--     update auth.users
--     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"peran": "superadmin"}'::jsonb
--     where email = 'USERNAME_LAIN@stokku.local';
--   Sengaja TIDAK disediakan lewat UI/API supaya superadmin tidak bisa
--   membuat superadmin lain lewat aplikasi (lihat app/api/pengguna/route.ts,
--   yang hanya menerima peran 'admin' atau 'staf' saat membuat user baru).
-- - Untuk membuat/mengelola akun SUPABASE_SERVICE_ROLE_KEY di
--   .env.local, lihat .env.local.example -- kunci ini WAJIB dirahasiakan
--   (jangan pernah dipakai di kode client / NEXT_PUBLIC_*).
