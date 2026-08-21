-- ============================================================
-- Set peran untuk beberapa user sekaligus.
-- Jalankan di Supabase Dashboard > SQL Editor SETELAH:
--   1. akun-akun di bawah sudah dibuat lewat
--      Authentication > Users > Add user (dengan Auto Confirm User)
--   2. supabase/role-policies.sql sudah dijalankan
--
-- User yang sudah login saat perannya diubah perlu logout lalu
-- login lagi supaya token JWT membawa metadata "peran" terbaru.
-- ============================================================

-- superadmin -> admin (akses penuh)
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"peran": "admin"}'::jsonb
where email = 'superadmin@stokku.local';

-- staff -> staf gudang (akses terbatas: tidak bisa tambah/hapus
-- barang atau ubah nama/SKU/kategori/harga)
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"peran": "staf"}'::jsonb
where email = 'staff@stokku.local';

-- ============================================================
-- Cek hasilnya
-- ============================================================
select
  email,
  raw_user_meta_data->>'peran' as peran,
  created_at
from auth.users
order by created_at;
