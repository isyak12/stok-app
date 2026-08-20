-- ============================================================
-- Perketat akses: hanya user yang sudah login yang boleh
-- membaca/mengubah data produk, stok, transaksi_stok, cabang,
-- dan transfer_stok.
-- Jalankan setelah mengaktifkan Supabase Auth.
--
-- !! PENTING: kelima tabel ini WAJIB ditutup semua. Kalau ada
-- yang terlewat, tabel itu masih pakai policy default "Izinkan
-- semua akses" (using (true)) — artinya siapa pun yang punya
-- anon key (yang memang publik, ada di .env.local / kode
-- frontend) masih bisa baca-tulis bebas ke tabel itu lewat
-- Supabase REST API langsung, TANPA perlu login sama sekali.
-- ============================================================

drop policy if exists "Izinkan semua akses produk" on produk;
drop policy if exists "Izinkan semua akses stok" on stok;
drop policy if exists "Izinkan semua akses transaksi_stok" on transaksi_stok;
drop policy if exists "Izinkan semua akses cabang" on cabang;
drop policy if exists "Semua user login boleh lihat cabang" on cabang;
drop policy if exists "Hanya user login yang boleh akses transfer_stok" on transfer_stok;

create policy "Hanya user login yang boleh akses produk"
  on produk for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya user login yang boleh akses stok"
  on stok for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya user login yang boleh akses transaksi_stok"
  on transaksi_stok for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya user login yang boleh akses cabang"
  on cabang for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya user login yang boleh akses transfer_stok"
  on transfer_stok for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
