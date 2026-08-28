-- ============================================================
-- Migrasi: aktifkan Supabase Realtime pada tabel transfer_stok.
--
-- Dibutuhkan oleh fitur notifikasi lonceng "Transfer Menunggu
-- Konfirmasi" di Sidebar (lihat lib/storage.ts -> hook
-- useTransferMenunggu, components/NotifikasiTransferMasuk.tsx).
-- Tanpa ini, badge & daftar notifikasi TETAP tampil saat halaman
-- pertama dibuka (query awal jalan seperti biasa), tapi TIDAK akan
-- otomatis update saat ada transfer baru dicatat / dikonfirmasi /
-- dibatalkan oleh user lain -- staf harus refresh manual.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor. Bisa juga
-- dilakukan lewat UI: Database > Replication > pilih publication
-- "supabase_realtime" > centang tabel "transfer_stok" -- dua cara
-- ini hasilnya sama, pilih salah satu saja.
--
-- Aman dijalankan berkali-kali: `alter publication ... add table`
-- akan error kalau tabel sudah terdaftar, makanya dibungkus blok
-- DO supaya idempotent (tidak gagal walau dijalankan ulang).
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transfer_stok'
  ) then
    alter publication supabase_realtime add table transfer_stok;
  end if;
end $$;

-- ============================================================
-- Catatan
-- ============================================================
-- - RLS tabel transfer_stok (lihat supabase/transfer_stok.sql) tetap
--   berlaku untuk Realtime -- user yang tidak login tidak akan
--   menerima event apa pun dari tabel ini, konsisten dengan akses
--   baca lewat query biasa.
-- - Fitur ini SENGAJA belum memfilter notifikasi per cabang staf yang
--   login, karena aplikasi belum punya konsep "user ditugaskan di
--   cabang X" -- semua staf yang login akan melihat SEMUA transfer
--   masuk yang menunggu konfirmasi, ke cabang mana pun. Lihat
--   komentar di lib/storage.ts (useTransferMenunggu) untuk detail
--   & catatan kalau nanti mau menambah filter per cabang.
-- ============================================================
