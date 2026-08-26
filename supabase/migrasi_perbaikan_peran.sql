-- ============================================================
-- Migrasi: pindahkan sumber "peran" dari user_metadata ke
-- app_metadata. Menutup celah privilege escalation: user_metadata
-- bisa diubah SENDIRI oleh user yang login lewat client SDK
-- (supabase.auth.updateUser({ data: { peran: "admin" } })), sehingga
-- staf biasa bisa menaikkan dirinya jadi admin dan melewati semua
-- RLS policy & trigger yang mengandalkan saya_admin().
--
-- app_metadata TIDAK bisa diubah user dari client -- hanya lewat
-- Admin API atau langsung di SQL Editor (service role / postgres
-- role), makanya field peran dipindah ke sana.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- role-policies.sql. Aman dijalankan berkali-kali (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Salin nilai "peran" yang sudah ada di user_metadata ke
--    app_metadata untuk semua user (kalau ada yang sudah pernah
--    di-set lewat set-peran-user.sql versi lama).
-- ------------------------------------------------------------
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('peran', raw_user_meta_data ->> 'peran')
where raw_user_meta_data ->> 'peran' is not null;

-- Hapus field "peran" dari user_metadata supaya tidak ada dua sumber
-- kebenaran yang bisa membingungkan (dan supaya nilai lama di
-- user_metadata tidak bisa dipakai untuk apa pun lagi).
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'peran'
where raw_user_meta_data ->> 'peran' is not null;

-- ------------------------------------------------------------
-- 2. Ganti ulang fungsi peran_saya() supaya baca dari app_metadata.
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

-- saya_admin() tidak perlu diubah, dia cuma manggil peran_saya().

-- ============================================================
-- Catatan
-- ============================================================
-- - Semua user yang SEDANG login (JWT lama) perlu logout lalu login
--   lagi supaya token JWT membawa app_metadata terbaru dan
--   peran_saya() membaca nilai yang benar.
-- - Setelah ini, untuk set/ubah peran seseorang, WAJIB dilakukan lewat
--   SQL Editor (lihat set-peran-user.sql versi baru) atau Supabase
--   Admin API -- TIDAK BISA lagi lewat Dashboard > Authentication >
--   Users > "User Metadata" (itu menulis ke user_metadata, bukan
--   app_metadata). Kalau mau lewat Dashboard, cari field
--   "Raw App Meta Data" di halaman detail user tersebut.