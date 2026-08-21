-- ============================================================
-- Migrasi: batalkan (void) transaksi stok masuk/keluar yang salah
-- catat, dengan jejak audit siapa & kapan membatalkan.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, migrasi_cabang.sql,
-- migrasi_transaksi_cabang.sql, DAN mutasi_detail.sql (butuh kolom
-- & function dari file-file itu semua sudah ada, terutama function
-- catat_transaksi_stok versi terbaru dengan dibuat_oleh dkk).
--
-- Menutup celah: sebelum migrasi ini, transaksi stok yang sudah
-- dicatat bersifat permanen. Salah input jumlah cuma bisa dibetulkan
-- dengan mencatat transaksi balik secara manual (mis. transaksi
-- "masuk" susulan untuk menutupi kesalahan transaksi "keluar") —
-- cara ini bikin riwayat penuh transaksi tambal-sulam yang tidak
-- jelas mana transaksi asli dan mana koreksi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom detail baru di transaksi_stok untuk mencatat pembatalan
-- ------------------------------------------------------------
-- dibatalkan: penanda cepat (dipakai di check constraint & query),
--   selain status via kolom dibatalkan_pada IS NOT NULL.
-- dibatalkan_oleh / dibatalkan_oleh_nama / dibatalkan_pada /
--   alasan_pembatalan: sama polanya seperti transfer_stok di
--   supabase/pembatalan_transfer.sql.
alter table transaksi_stok
  add column if not exists dibatalkan boolean not null default false,
  add column if not exists dibatalkan_oleh uuid references auth.users(id),
  add column if not exists dibatalkan_oleh_nama text,
  add column if not exists dibatalkan_pada timestamptz,
  add column if not exists alasan_pembatalan text;

create index if not exists idx_transaksi_stok_dibatalkan
  on transaksi_stok(dibatalkan);

-- ------------------------------------------------------------
-- 2. Function: batalkan transaksi stok
-- ------------------------------------------------------------
-- Mengoreksi efek transaksi ke tabel `stok` (kebalikan dari
-- catat_transaksi_stok), lalu menandai transaksi sebagai dibatalkan.
-- Baris transaksi TIDAK dihapus — tetap ada di riwayat sebagai jejak
-- audit, hanya ditandai dibatalkan + siapa/kapan/kenapa.
--
-- Catatan desain: fitur ini SENGAJA tidak dibatasi "hanya transaksi
-- terakhir yang boleh dibatalkan". Staf sering baru sadar salah
-- input beberapa transaksi kemudian, bukan cuma yang paling akhir.
-- Yang penting jejak siapa & kapan membatalkan tetap tercatat, dan
-- transaksi yang sudah dibatalkan tidak bisa dibatalkan dua kali.
--
-- Baris stok terkait dikunci (for update) sama seperti pola di
-- catat_transaksi_stok, supaya aman dari race condition kalau ada
-- transaksi/transfer lain berjalan bersamaan untuk produk+cabang
-- yang sama.
create or replace function batalkan_transaksi_stok(
  p_transaksi_id uuid,
  p_alasan text default null
)
returns transaksi_stok
language plpgsql
security definer
as $$
declare
  v_transaksi transaksi_stok;
  v_stok_sekarang integer;
begin
  select * into v_transaksi
  from transaksi_stok
  where id = p_transaksi_id
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if v_transaksi.dibatalkan then
    raise exception 'Transaksi ini sudah dibatalkan sebelumnya';
  end if;

  -- Kunci baris stok terkait dulu.
  select jumlah into v_stok_sekarang
  from stok
  where produk_id = v_transaksi.produk_id
    and cabang_id = v_transaksi.cabang_id
  for update;

  if not found then
    raise exception 'Data stok untuk produk ini di cabang terkait tidak ditemukan';
  end if;

  -- Kebalikan dari catat_transaksi_stok: transaksi 'masuk' dulu
  -- MENAMBAH stok, jadi dibatalkan berarti MENGURANGI; transaksi
  -- 'keluar' dulu MENGURANGI stok, jadi dibatalkan berarti
  -- MENGEMBALIKAN (menambah).
  if v_transaksi.tipe = 'masuk' and v_stok_sekarang < v_transaksi.jumlah then
    raise exception
      'Tidak bisa membatalkan: stok saat ini (%) sudah lebih kecil dari jumlah transaksi ini (%), kemungkinan sebagian sudah terpakai transaksi/transfer lain setelahnya',
      v_stok_sekarang, v_transaksi.jumlah;
  end if;

  update stok
  set jumlah = jumlah
    + case when v_transaksi.tipe = 'masuk' then -v_transaksi.jumlah else v_transaksi.jumlah end
  where produk_id = v_transaksi.produk_id
    and cabang_id = v_transaksi.cabang_id;

  update transaksi_stok
  set dibatalkan = true,
      dibatalkan_oleh = auth.uid(),
      dibatalkan_oleh_nama = auth.email(),
      dibatalkan_pada = now(),
      alasan_pembatalan = p_alasan
  where id = p_transaksi_id
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Dipanggil dari frontend lewat lib/storage.ts (hook
--   useTransaksiStok, fungsi batalkan), komponen TransaksiStokTable,
--   dan halaman app/(dashboard)/stok/[id]/transaksi.
-- - Transaksi 'keluar' selalu aman dibatalkan (mengembalikan stok
--   tidak pernah membuat stok jadi negatif). Transaksi 'masuk' bisa
--   ditolak pembatalannya kalau stok sekarang sudah lebih kecil dari
--   jumlah transaksi tsb (barangnya sudah kadung keluar/terpindah
--   lewat transaksi atau transfer lain) — pesan error menjelaskan
--   ini supaya staf tahu perlu koreksi manual/telusur dulu.
-- - Kolom dibatalkan_oleh_nama diisi otomatis dari auth.email() di
--   dalam function (security definer) — bukan dikirim dari client.
