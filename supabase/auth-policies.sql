-- ============================================================
-- Perketat akses: hanya user yang sudah login yang boleh
-- membaca/mengubah data produk & stok.
-- Jalankan setelah mengaktifkan Supabase Auth.
-- ============================================================

drop policy if exists "Izinkan semua akses produk" on produk;
drop policy if exists "Izinkan semua akses stok" on stok;

create policy "Hanya user login yang boleh akses produk"
  on produk for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Hanya user login yang boleh akses stok"
  on stok for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
