-- ============================================================
-- Migrasi: batalkan/tolak transfer stok yang masih "Terkirim".
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, migrasi_cabang.sql,
-- migrasi_transaksi_cabang.sql, transfer_stok.sql, DAN
-- mutasi_detail.sql (butuh kolom & function dari file-file itu
-- semua sudah ada, terutama kolom transfer_stok.status).
--
-- Menutup celah: sebelum migrasi ini, alur transfer cuma bisa maju
-- (kirim -> konfirmasi terima). Kalau salah kirim, salah jumlah,
-- atau transfer ternyata dibatalkan, satu-satunya cara mengembalikan
-- stok ke cabang asal adalah edit manual di database.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom detail baru di transfer_stok untuk mencatat pembatalan
-- ------------------------------------------------------------
-- dibatalkan_oleh / dibatalkan_oleh_nama / dibatalkan_pada: siapa &
--   kapan pembatalan dilakukan (pola sama seperti diterima_oleh /
--   diterima_oleh_nama / diterima_pada di mutasi_detail.sql).
-- alasan_pembatalan: catatan bebas kenapa dibatalkan (opsional),
--   mis. "salah kirim cabang", "jumlah salah input", dll.
alter table transfer_stok
  add column if not exists dibatalkan_oleh uuid references auth.users(id),
  add column if not exists dibatalkan_oleh_nama text,
  add column if not exists dibatalkan_pada timestamptz,
  add column if not exists alasan_pembatalan text;

-- Perluas constraint status supaya menerima 'dibatalkan'. Constraint
-- lama dibuat inline lewat "check (...)" di mutasi_detail.sql, jadi
-- namanya mengikuti konvensi default Postgres <tabel>_<kolom>_check.
alter table transfer_stok
  drop constraint if exists transfer_stok_status_check;

alter table transfer_stok
  add constraint transfer_stok_status_check
  check (status in ('terkirim', 'diterima', 'dibatalkan'));

-- ------------------------------------------------------------
-- 2. Function: batalkan transfer yang masih "Terkirim"
-- ------------------------------------------------------------
-- Mengembalikan stok yang sudah dikurangi dari cabang asal saat
-- transfer dicatat (lihat catat_transfer_stok di mutasi_detail.sql),
-- lalu menandai transfer sebagai 'dibatalkan'. Baris stok cabang
-- asal dikunci (for update) sama seperti pola di
-- catat_transfer_stok / konfirmasi_terima_transfer, supaya aman dari
-- race condition kalau ada transfer/transaksi lain berjalan
-- bersamaan untuk produk+cabang yang sama.
--
-- Hanya transfer berstatus 'terkirim' yang boleh dibatalkan:
-- - Transfer yang sudah 'diterima' TIDAK boleh dibatalkan lewat sini
--   (stok tujuan sudah dipakai/tercampur secara logis dengan stok
--   cabang tujuan; pembatalan di titik itu perlu tercatat sebagai
--   transaksi/transfer baru, bukan menghapus jejak yang sudah terjadi).
-- - Transfer yang sudah 'dibatalkan' tidak bisa dibatalkan dua kali
--   (mencegah stok asal bertambah dobel).
create or replace function batalkan_transfer_stok(
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
      'Transfer yang sudah dikonfirmasi diterima tidak bisa dibatalkan';
  end if;

  if v_transfer.status = 'dibatalkan' then
    raise exception 'Transfer ini sudah dibatalkan sebelumnya';
  end if;

  -- Kunci baris stok cabang asal, lalu kembalikan jumlah yang tadi
  -- dikurangi saat transfer dicatat.
  perform 1
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id
  for update;

  update stok
  set jumlah = jumlah + v_transfer.jumlah
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  if not found then
    -- Baris stok cabang asal seharusnya selalu ada (transfer ini
    -- dulu dibuat dari baris itu), tapi dijaga untuk kasus tidak
    -- terduga (mis. baris stok terhapus manual) supaya jumlah yang
    -- dikembalikan tidak hilang begitu saja.
    insert into stok (produk_id, cabang_id, jumlah, stok_minimum, lokasi)
    values (v_transfer.produk_id, v_transfer.dari_cabang_id, v_transfer.jumlah, 0, '');
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
-- - Dipanggil dari frontend lewat lib/storage.ts (hook
--   useTransferStok, fungsi batalkan), komponen TransferStokTable,
--   dan halaman app/(dashboard)/stok/[id]/transfer.
-- - Kolom dibatalkan_oleh_nama diisi otomatis dari auth.email() di
--   dalam function (security definer) — bukan dikirim dari client,
--   sama seperti pola diterima_oleh_nama di mutasi_detail.sql.
