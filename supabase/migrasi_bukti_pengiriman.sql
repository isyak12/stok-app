-- ============================================================
-- Migrasi: bukti foto SEBELUM barang dikirim pada transfer stok
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, migrasi_cabang.sql,
-- transfer_stok.sql, mutasi_detail.sql, pembatalan_transfer.sql /
-- migrasi_batal_transfer.sql, DAN migrasi_bukti_penerimaan.sql
-- (butuh tabel transfer_stok, function catat_transfer_stok versi
-- terbaru, dan bucket Storage "bukti-transfer" sudah ada -- bucket
-- yang sama dipakai ulang di sini, tidak perlu bucket baru).
--
-- Menambahkan:
-- 1. Kolom bukti_foto_url_kirim di transfer_stok -- foto kondisi
--    barang SEBELUM dikirim dari cabang asal (mis. packing, jumlah
--    fisik), terpisah dari bukti_foto_url yang isinya foto SAAT
--    diterima di cabang tujuan.
-- 2. Update function catat_transfer_stok supaya menerima & menyimpan
--    URL foto tersebut (WAJIB diisi, sama seperti bukti penerimaan).
-- ============================================================

-- ============================================================
-- 1. Kolom baru di transfer_stok
-- ============================================================
alter table transfer_stok
  add column if not exists bukti_foto_url_kirim text;

-- ============================================================
-- 2. Update catat_transfer_stok: wajib foto sebelum kirim
-- ============================================================
-- drop dulu karena signature (jumlah parameter) berubah dari versi
-- di mutasi_detail.sql.
drop function if exists catat_transfer_stok(uuid, uuid, uuid, integer, text);

create or replace function catat_transfer_stok(
  p_produk_id uuid,
  p_dari_cabang_id uuid,
  p_ke_cabang_id uuid,
  p_jumlah integer,
  p_bukti_foto_url_kirim text,
  p_catatan text default null
)
returns transfer_stok
language plpgsql
security definer
as $$
declare
  v_stok_asal integer;
  v_transfer transfer_stok;
begin
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah harus lebih besar dari 0';
  end if;

  if p_dari_cabang_id is null or p_ke_cabang_id is null then
    raise exception 'Cabang asal dan cabang tujuan harus dipilih';
  end if;

  if p_dari_cabang_id = p_ke_cabang_id then
    raise exception 'Cabang asal dan cabang tujuan tidak boleh sama';
  end if;

  if p_bukti_foto_url_kirim is null or length(trim(p_bukti_foto_url_kirim)) = 0 then
    raise exception 'Bukti foto sebelum kirim wajib diunggah';
  end if;

  -- Kunci baris stok cabang asal dulu (harus sudah ada & cukup)
  select jumlah into v_stok_asal
  from stok
  where produk_id = p_produk_id
    and cabang_id = p_dari_cabang_id
  for update;

  if not found then
    raise exception 'Data stok untuk produk ini di cabang asal tidak ditemukan';
  end if;

  if v_stok_asal < p_jumlah then
    raise exception
      'Stok di cabang asal tidak cukup. Stok saat ini % , diminta %',
      v_stok_asal, p_jumlah;
  end if;

  -- Stok cabang asal berkurang begitu barang dikirim. Stok cabang
  -- tujuan baru bertambah saat dikonfirmasi diterima (lihat
  -- konfirmasi_terima_transfer di migrasi_bukti_penerimaan.sql).
  --
  -- PENTING (bugfix): trigger dari migrasi_kunci_jumlah_manual.sql
  -- mewajibkan flag 'stokku.izinkan_ubah_jumlah' aktif sebelum UPDATE
  -- stok.jumlah dilakukan di luar RPC transaksi normal. Baris
  -- `perform set_config` di bawah ini SEBELUMNYA tidak ada di file
  -- ini -- akibatnya, begitu trigger tersebut aktif, mencatat
  -- transfer baru SELALU gagal dengan error "Jumlah stok tidak bisa
  -- diubah manual...", padahal dipanggil dari jalur resmi
  -- catat_transfer_stok(). Pola ini sudah konsisten dipakai di semua
  -- function lain yang meng-update stok.jumlah (lihat
  -- catat_transaksi_stok, konfirmasi_terima_transfer, dst).
  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
  update stok
  set jumlah = jumlah - p_jumlah
  where produk_id = p_produk_id
    and cabang_id = p_dari_cabang_id;

  insert into transfer_stok (
    produk_id, dari_cabang_id, ke_cabang_id, jumlah, catatan,
    status, dibuat_oleh, dibuat_oleh_nama, bukti_foto_url_kirim
  )
  values (
    p_produk_id, p_dari_cabang_id, p_ke_cabang_id, p_jumlah, p_catatan,
    'terkirim', auth.uid(), auth.email(), p_bukti_foto_url_kirim
  )
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Setelah migrasi ini, function catat_transfer_stok LAMA (5
--   parameter, tanpa p_bukti_foto_url_kirim) sudah tidak ada lagi.
--   Pastikan kode frontend (lib/storage.ts, TransferStokForm) sudah
--   diupdate BARENGAN dengan migrasi ini, kalau tidak transfer baru
--   akan gagal dicatat dengan error "function does not exist".
-- - Transfer LAMA (dicatat sebelum migrasi ini) akan punya
--   bukti_foto_url_kirim = NULL. Ini tidak masalah -- UI cukup
--   menampilkan "Tidak ada foto" untuk baris lama tersebut, sama
--   seperti perlakuan bukti_foto_url pada migrasi_bukti_penerimaan.sql.
-- - Bucket Storage yang dipakai tetap "bukti-transfer" (sudah dibuat
--   di migrasi_bukti_penerimaan.sql) -- foto kirim & foto terima
--   sama-sama disimpan di situ, dibedakan lewat nama file.
