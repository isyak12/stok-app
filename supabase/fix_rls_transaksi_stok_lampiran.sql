-- ============================================================
-- Perbaikan: tabel transaksi_stok_lampiran tertinggal dari
-- auth-policies.sql (tabel ini dibuat belakangan, di
-- migrasi_bukti_transaksi_stok.sql) — masih pakai policy prototipe
-- "using (true)" yang mengizinkan akses baca/tulis TANPA login
-- lewat anon key. Semua tabel lain (produk, stok, transaksi_stok,
-- cabang, transfer_stok) sudah ditutup di auth-policies.sql; file
-- ini menutup tabel yang tertinggal itu dengan pola yang sama.
--
-- Jalankan di Supabase SQL Editor. Aman dijalankan berkali-kali.
-- ============================================================

drop policy if exists "Izinkan semua akses transaksi_stok_lampiran" on transaksi_stok_lampiran;

create policy "Hanya user login yang boleh akses transaksi_stok_lampiran"
  on transaksi_stok_lampiran for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
