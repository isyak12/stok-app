-- ============================================================
-- Cek cepat: apakah ada fungsi dengan NAMA sama tapi SIGNATURE
-- (jumlah/tipe parameter) berbeda hidup berdampingan di database?
-- Jalankan ini di Supabase SQL Editor SEBELUM dan SESUDAH menjalankan
-- ulang migrasi_bukti_transaksi_stok.sql untuk memastikan overload
-- catat_transaksi_stok() sudah bersih.
-- ============================================================

select
  p.proname as nama_fungsi,
  p.pronargs as jumlah_parameter,
  pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'catat_transaksi_stok',
    'catat_transfer_stok',
    'konfirmasi_terima_transfer',
    'catat_stok_opname',
    'batalkan_transaksi_stok',
    'batalkan_transfer_stok',
    'batalkan_transfer'
  )
order by p.proname, p.pronargs;

-- Kalau nama fungsi yang sama muncul LEBIH DARI SEKALI di hasil di
-- atas (baris dengan pronargs / signature berbeda), berarti ada
-- overload nyangkut -- itu tandanya perlu drop manual versi lama,
-- atau jalankan ulang migrasi_bukti_transaksi_stok.sql (untuk
-- catat_transaksi_stok) yang sudah ditambal.
--
-- Kondisi SEHAT: masing-masing dari ketujuh nama fungsi di atas
-- HANYA muncul SATU KALI.
