-- ============================================================
-- Migrasi: batalkan/tolak transfer yang masih berstatus "terkirim"
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- mutasi_detail.sql (butuh kolom transfer_stok.status sudah ada).
--
-- Masalah yang diperbaiki: alur transfer sebelumnya cuma bisa maju
-- (kirim -> konfirmasi terima). Kalau salah kirim atau ternyata
-- batal, stok cabang asal yang sudah terlanjur dikurangi saat
-- dikirim tidak ada cara mengembalikannya selain edit manual di
-- database.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom detail pembatalan di transfer_stok
-- ------------------------------------------------------------
alter table transfer_stok
  add column if not exists dibatalkan_oleh uuid references auth.users(id),
  add column if not exists dibatalkan_oleh_nama text,
  add column if not exists dibatalkan_pada timestamptz,
  add column if not exists alasan_pembatalan text;

-- Perluas check constraint status supaya menerima 'dibatalkan'.
-- Nama constraint ini otomatis dari Postgres saat kolom dibuat inline
-- di mutasi_detail.sql (tanpa nama eksplisit): <tabel>_<kolom>_check.
alter table transfer_stok
  drop constraint if exists transfer_stok_status_check;

alter table transfer_stok
  add constraint transfer_stok_status_check
  check (status in ('terkirim', 'diterima', 'dibatalkan'));

-- ------------------------------------------------------------
-- 2. Function: batalkan_transfer
-- ------------------------------------------------------------
-- Hanya bisa dipanggil untuk transfer berstatus 'terkirim' (belum
-- dikonfirmasi diterima). Mengembalikan `jumlah` ke stok cabang asal
-- (karena stok itu sudah dikurangi saat transfer dicatat), lalu
-- menandai transfer sebagai 'dibatalkan' berikut siapa & kapan &
-- alasannya — baris transfer TIDAK dihapus, supaya riwayat/jejak
-- audit tetap lengkap.
create or replace function batalkan_transfer(
  p_transfer_id uuid,
  p_alasan text default null
)
returns transfer_stok
language plpgsql
security definer
as $$
declare
  v_transfer transfer_stok;
begin
  select * into v_transfer
  from transfer_stok
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer tidak ditemukan';
  end if;

  if v_transfer.status = 'diterima' then
    raise exception
      'Transfer yang sudah diterima cabang tujuan tidak bisa dibatalkan. Catat transfer balik (dari cabang tujuan ke cabang asal) kalau perlu dikembalikan.';
  end if;

  if v_transfer.status = 'dibatalkan' then
    raise exception 'Transfer ini sudah dibatalkan sebelumnya';
  end if;

  -- Kembalikan stok ke cabang asal (dikunci dulu supaya aman dari
  -- race condition dengan transaksi lain yang berjalan bersamaan).
  update stok
  set jumlah = jumlah + v_transfer.jumlah
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  if not found then
    -- Kasus langka: baris stok cabang asal sudah terhapus (mis. produk
    -- dihapus lalu dibuat ulang). Tetap lanjutkan pembatalan transfer
    -- supaya statusnya tidak menggantung, tapi beri tahu di pesan.
    raise notice
      'Baris stok cabang asal untuk produk % tidak ditemukan, stok tidak dikembalikan otomatis.',
      v_transfer.produk_id;
  end if;

  update transfer_stok
  set status = 'dibatalkan',
      dibatalkan_oleh = auth.uid(),
      dibatalkan_oleh_nama = auth.email(),
      dibatalkan_pada = now(),
      alasan_pembatalan = p_alasan
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Transfer yang sudah 'diterima' sengaja TIDAK bisa dibatalkan lewat
--   function ini, karena stok tujuan sudah bertambah dan mungkin sudah
--   ikut terpakai/terjual di sana. Kalau perlu dikoreksi, buat transfer
--   balik (cabang tujuan -> cabang asal) secara manual lewat form yang
--   sudah ada.
-- - Dipanggil dari frontend lewat lib/storage.ts (hook useTransferStok,
--   fungsi batalkanTransfer) dan tombol "Tolak" di TransferStokTable.
