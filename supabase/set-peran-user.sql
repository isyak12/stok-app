-- ============================================================
-- Set peran untuk beberapa user sekaligus.
-- Jalankan di Supabase Dashboard > SQL Editor SETELAH:
--   1. akun-akun di bawah sudah dibuat lewat
--      Authentication > Users > Add user (dengan Auto Confirm User)
--   2. supabase/role-policies.sql sudah dijalankan
--   3. supabase/migrasi_perbaikan_peran.sql sudah dijalankan
--
-- PENTING: peran disimpan di app_metadata (raw_app_meta_data), BUKAN
-- user_metadata -- karena app_metadata tidak bisa diubah sendiri oleh
-- user dari client SDK (beda dengan user_metadata yang bisa). Jangan
-- pernah ganti balik ke raw_user_meta_data, itu celah keamanan.
--
-- User yang sudah login saat perannya diubah perlu logout lalu
-- login lagi supaya token JWT membawa app_metadata "peran" terbaru.
-- ============================================================

-- superadmin -> admin (akses penuh)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"peran": "admin"}'::jsonb
where email = 'superadmin@stokku.local';

-- staff -> staf gudang (akses terbatas: tidak bisa tambah/hapus
-- barang atau ubah nama/SKU/kategori/harga)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"peran": "staf"}'::jsonb
where email = 'staff@stokku.local';

-- ============================================================
-- Cek hasilnya
-- ============================================================
select
  email,
  raw_app_meta_data->>'peran' as peran,
  created_at
from auth.users
order by created_at;