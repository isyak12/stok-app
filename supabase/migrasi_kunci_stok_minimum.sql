-- ============================================================
-- Migrasi: kunci kolom stok_minimum di tabel `stok` supaya hanya
-- admin/superadmin yang boleh mengubahnya. Staf gudang tetap boleh
-- mengubah `jumlah` dan `lokasi` (itu memang pekerjaan harian
-- mereka) -- lihat komentar di role-policies.sql yang sebelumnya
-- membuka SEMUA kolom tabel stok (termasuk stok_minimum) untuk
-- semua user login.
--
-- Kenapa stok_minimum perlu dikunci:
-- Field ini adalah ambang batas untuk alert "stok menipis" di
-- Dasbor (lihat stokRendah di lib/types.ts). Kalau staf bisa bebas
-- mengubahnya, staf yang malas restock bisa menurunkan angka ini
-- (mis. jadi 0) supaya alert-nya hilang -- padahal barang memang
-- perlu direstock. Ini keputusan kebijakan gudang, bukan tugas
-- operasional harian staf.
--
-- Pola migrasi ini SAMA PERSIS dengan
-- cegah_staf_ubah_data_master_produk() di role-policies.sql (yang
-- mengunci nama/sku/kategori/harga di tabel produk) -- supaya
-- konsisten dan gampang dirawat, bukan menciptakan pendekatan baru
-- yang beda gaya.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH:
--   1. schema.sql
--   2. role-policies.sql        (butuh saya_admin())
--   3. migrasi_perbaikan_peran.sql
--   4. migrasi_superadmin.sql   (supaya superadmin ikut diizinkan,
--                                 bukan cuma admin biasa)
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

create or replace function cegah_staf_ubah_stok_minimum()
returns trigger as $$
begin
  if not saya_admin() then
    if new.stok_minimum is distinct from old.stok_minimum then
      raise exception
        'Hanya admin yang boleh mengubah stok minimum.'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cegah_staf_ubah_stok_minimum on stok;
create trigger trg_cegah_staf_ubah_stok_minimum
before update on stok
for each row execute function cegah_staf_ubah_stok_minimum();

-- ============================================================
-- Catatan
-- ============================================================
-- - `jumlah` dan `lokasi` di tabel stok SENGAJA TIDAK ikut dikunci --
--   itu tetap tugas harian staf gudang (mencatat barang masuk/keluar
--   dan lokasi rak).
-- - Kalau nanti mau mengunci kolom lain di tabel `stok` juga (mis.
--   `lokasi` kalau ternyata itu juga kebijakan gudang pusat), tinggal
--   tambah kondisi `or new.lokasi is distinct from old.lokasi` di
--   dalam blok IF di atas -- tidak perlu trigger terpisah.
-- - Pesan error di atas (errcode 42501) akan tertangkap di
--   lib/storage.ts sebagai errStok.message saat fungsi perbarui()
--   dipanggil -- pastikan pesan itu ditampilkan ke user di UI supaya
--   staf tahu kenapa simpan gagal, bukan cuma "terjadi kesalahan".
