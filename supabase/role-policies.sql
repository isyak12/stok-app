-- ============================================================
-- Role & Akses: admin vs staf gudang
-- Jalankan SETELAH auth-policies.sql.
--
-- Cara set peran seorang user:
--   1. Supabase Dashboard > Authentication > Users > pilih user
--   2. Edit "User Metadata" (raw_user_meta_data), isi:
--        { "peran": "admin" }
--      atau
--        { "peran": "staf" }
--   3. User yang belum punya field "peran" dianggap "staf" (aman
--      secara default -- akses minimal kalau lupa di-set).
--
-- Aturan akses:
--   - produk (data master + harga): SELECT semua user login;
--     INSERT & DELETE hanya admin; UPDATE hanya admin yang boleh
--     mengubah nama/sku/kategori/harga_beli/harga_jual (staf tetap
--     bisa memicu UPDATE lewat form Ubah Barang selama nilai kolom
--     itu tidak berubah -- lihat trigger di bawah).
--   - stok (jumlah, lokasi, stok minimum): semua user login boleh
--     baca & ubah -- ini pekerjaan harian staf gudang.
-- ============================================================

-- --------------------------------------------------------------
-- Helper: baca peran user yang sedang login dari user metadata.
-- Default 'staf' kalau field "peran" belum pernah di-set.
-- --------------------------------------------------------------
create or replace function peran_saya()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'peran',
    'staf'
  );
$$;

create or replace function saya_admin()
returns boolean
language sql
stable
as $$
  select peran_saya() = 'admin';
$$;

-- --------------------------------------------------------------
-- Tabel produk: pisahkan policy per operasi supaya INSERT & DELETE
-- bisa dibatasi admin, sementara SELECT tetap terbuka untuk semua
-- user login.
-- --------------------------------------------------------------
drop policy if exists "Izinkan semua akses produk" on produk;
drop policy if exists "Hanya user login yang boleh akses produk" on produk;
drop policy if exists "Semua user login boleh lihat produk" on produk;
drop policy if exists "Hanya admin boleh tambah produk" on produk;
drop policy if exists "Semua user login boleh ubah produk" on produk;
drop policy if exists "Hanya admin boleh hapus produk" on produk;

create policy "Semua user login boleh lihat produk"
  on produk for select
  using (auth.role() = 'authenticated');

create policy "Hanya admin boleh tambah produk"
  on produk for insert
  with check (saya_admin());

-- UPDATE tetap terbuka untuk semua user login di level RLS -- staf
-- perlu bisa memicu UPDATE ini saat menyimpan form Ubah Barang
-- (meski yang benar-benar berubah cuma kolom di tabel stok).
-- Yang benar-benar mencegah staf mengubah nama/sku/kategori/harga
-- adalah TRIGGER di bawah, bukan policy ini.
create policy "Semua user login boleh ubah produk"
  on produk for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya admin boleh hapus produk"
  on produk for delete
  using (saya_admin());

-- --------------------------------------------------------------
-- Trigger: staf gudang boleh memicu UPDATE ke tabel produk (lewat
-- form Ubah Barang), TAPI tidak boleh benar-benar mengubah nilai
-- nama, sku, kategori, harga_beli, atau harga_jual. Kalau salah
-- satu kolom itu berubah dan yang login bukan admin -> ditolak.
-- --------------------------------------------------------------
create or replace function cegah_staf_ubah_data_master_produk()
returns trigger as $$
begin
  if not saya_admin() then
    if new.nama is distinct from old.nama
       or new.sku is distinct from old.sku
       or new.kategori is distinct from old.kategori
       or new.harga_beli is distinct from old.harga_beli
       or new.harga_jual is distinct from old.harga_jual
    then
      raise exception
        'Hanya admin yang boleh mengubah nama, SKU, kategori, atau harga barang.'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cegah_staf_ubah_produk on produk;
create trigger trg_cegah_staf_ubah_produk
before update on produk
for each row execute function cegah_staf_ubah_data_master_produk();

-- --------------------------------------------------------------
-- Tabel stok: pekerjaan harian staf gudang (jumlah, lokasi, stok
-- minimum) -- tetap terbuka untuk semua user login. DELETE
-- dibatasi admin sebagai lapisan pengaman tambahan (biasanya baris
-- stok ikut terhapus otomatis lewat ON DELETE CASCADE saat produk
-- dihapus, dan hapus produk sudah dibatasi admin di atas).
-- --------------------------------------------------------------
-- PENTING: policy "for all" dan policy "for delete" terpisah akan
-- DIGABUNG dengan OR (permissive) oleh Postgres, bukan saling
-- membatasi -- jadi delete WAJIB dipisah dari select/insert/update
-- di sini, bukan pakai "for all".
drop policy if exists "Izinkan semua akses stok" on stok;
drop policy if exists "Hanya user login yang boleh akses stok" on stok;
drop policy if exists "Semua user login boleh akses stok" on stok;
drop policy if exists "Hanya admin boleh hapus stok" on stok;

create policy "Semua user login boleh lihat stok"
  on stok for select
  using (auth.role() = 'authenticated');

create policy "Semua user login boleh tambah stok"
  on stok for insert
  with check (auth.role() = 'authenticated');

create policy "Semua user login boleh ubah stok"
  on stok for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya admin boleh hapus stok"
  on stok for delete
  using (saya_admin());
