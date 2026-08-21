-- ============================================================
-- Migrasi: detail riwayat mutasi (siapa mencatat, pihak terkait,
-- no. referensi) + alur konfirmasi terima untuk transfer stok.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, migrasi_cabang.sql, DAN
-- transfer_stok.sql (butuh tabel & function itu semua sudah ada).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom detail baru di transaksi_stok
-- ------------------------------------------------------------
-- dibuat_oleh / dibuat_oleh_nama: siapa staf yang mencatat transaksi
--   ini. Disimpan sebagai uuid (referensi resmi ke auth.users) DAN
--   sebagai teks email (snapshot), karena auth.users tidak bisa
--   di-join langsung dari client (anon/authenticated key) — kolom
--   teks inilah yang dipakai untuk ditampilkan di UI.
-- pihak: nama pembeli (transaksi keluar) atau nama supplier
--   (transaksi masuk). Bebas teks, bukan akun aplikasi.
-- no_referensi: nomor nota/invoice/PO terkait (opsional).
alter table transaksi_stok
  add column if not exists dibuat_oleh uuid references auth.users(id),
  add column if not exists dibuat_oleh_nama text,
  add column if not exists pihak text,
  add column if not exists no_referensi text;

-- Ganti ulang function catat_transaksi_stok supaya menerima &
-- menyimpan field baru di atas. Drop dulu versi lama (parameter
-- beda -> tidak bisa langsung create or replace).
drop function if exists catat_transaksi_stok(uuid, uuid, text, integer, text);

create or replace function catat_transaksi_stok(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_tipe text,
  p_jumlah integer,
  p_catatan text default null,
  p_pihak text default null,
  p_no_referensi text default null
)
returns transaksi_stok
language plpgsql
security definer
as $$
declare
  v_stok_sekarang integer;
  v_transaksi transaksi_stok;
begin
  if p_tipe not in ('masuk', 'keluar') then
    raise exception 'Tipe transaksi tidak valid: %', p_tipe;
  end if;

  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah harus lebih besar dari 0';
  end if;

  if p_cabang_id is null then
    raise exception 'Cabang harus dipilih';
  end if;

  select jumlah into v_stok_sekarang
  from stok
  where produk_id = p_produk_id
    and cabang_id = p_cabang_id
  for update;

  if not found then
    raise exception 'Data stok untuk produk ini di cabang yang dipilih tidak ditemukan';
  end if;

  if p_tipe = 'keluar' and v_stok_sekarang < p_jumlah then
    raise exception
      'Stok tidak cukup. Stok saat ini % , diminta %',
      v_stok_sekarang, p_jumlah;
  end if;

  update stok
  set jumlah = jumlah + case when p_tipe = 'masuk' then p_jumlah else -p_jumlah end
  where produk_id = p_produk_id
    and cabang_id = p_cabang_id;

  insert into transaksi_stok (
    produk_id, tipe, jumlah, catatan,
    dibuat_oleh, dibuat_oleh_nama, pihak, no_referensi
  )
  values (
    p_produk_id, p_tipe, p_jumlah, p_catatan,
    auth.uid(), auth.email(), p_pihak, p_no_referensi
  )
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ------------------------------------------------------------
-- 2. Alur Terkirim -> Diterima di transfer_stok
-- ------------------------------------------------------------
-- status: 'terkirim' saat baru dicatat (stok sudah keluar dari
--   cabang asal, tapi belum tentu sampai), 'diterima' setelah staf
--   di cabang tujuan konfirmasi barang sudah sampai (baru di titik
--   ini stok cabang tujuan bertambah).
-- dibuat_oleh_nama: snapshot email staf yang mengirim (kolom
--   dibuat_oleh uuid sudah ada dari transfer_stok.sql).
-- diterima_oleh / diterima_oleh_nama / diterima_pada: siapa &
--   kapan konfirmasi terima dilakukan.
alter table transfer_stok
  add column if not exists status text not null default 'diterima'
    check (status in ('terkirim', 'diterima')),
  add column if not exists dibuat_oleh_nama text,
  add column if not exists diterima_oleh uuid references auth.users(id),
  add column if not exists diterima_oleh_nama text,
  add column if not exists diterima_pada timestamptz;

-- Baris transfer yang SUDAH ada sebelum migrasi ini dianggap sudah
-- selesai/diterima (karena dulu stok tujuan langsung ditambahkan
-- saat dicatat) — makanya default kolom status di atas 'diterima',
-- supaya data lama tidak butuh diubah manual. Transfer BARU akan
-- eksplisit di-set 'terkirim' oleh function di bawah.

-- Ganti ulang function catat_transfer_stok: sekarang HANYA
-- mengurangi stok cabang asal saat transfer dikirim. Stok cabang
-- tujuan baru ditambahkan lewat function konfirmasi_terima_transfer
-- di bawah, saat staf cabang tujuan konfirmasi barang sudah sampai.
drop function if exists catat_transfer_stok(uuid, uuid, uuid, integer, text);

create or replace function catat_transfer_stok(
  p_produk_id uuid,
  p_dari_cabang_id uuid,
  p_ke_cabang_id uuid,
  p_jumlah integer,
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
  -- tujuan SENGAJA belum ditambah di sini -- baru bertambah saat
  -- dikonfirmasi diterima (lihat konfirmasi_terima_transfer).
  update stok
  set jumlah = jumlah - p_jumlah
  where produk_id = p_produk_id
    and cabang_id = p_dari_cabang_id;

  insert into transfer_stok (
    produk_id, dari_cabang_id, ke_cabang_id, jumlah, catatan,
    status, dibuat_oleh, dibuat_oleh_nama
  )
  values (
    p_produk_id, p_dari_cabang_id, p_ke_cabang_id, p_jumlah, p_catatan,
    'terkirim', auth.uid(), auth.email()
  )
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- Function baru: konfirmasi barang sudah sampai di cabang tujuan.
-- Menambah stok cabang tujuan (bikin baris baru kalau produk ini
-- belum pernah ada stok di cabang tujuan) & mencatat siapa/kapan
-- konfirmasi dilakukan. Menolak kalau transfer sudah pernah
-- dikonfirmasi sebelumnya (mencegah stok tujuan bertambah dobel).
create or replace function konfirmasi_terima_transfer(
  p_transfer_id uuid
)
returns transfer_stok
language plpgsql
security definer
as $$
declare
  v_transfer transfer_stok;
  v_stok_minimum_asal integer;
  v_lokasi_asal text;
begin
  select * into v_transfer
  from transfer_stok
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer tidak ditemukan';
  end if;

  if v_transfer.status = 'diterima' then
    raise exception 'Transfer ini sudah dikonfirmasi diterima sebelumnya';
  end if;

  -- Ambil stok_minimum & lokasi cabang asal sebagai titik awal yang
  -- wajar kalau produk ini belum pernah ada baris stok di cabang
  -- tujuan (sama seperti perilaku sebelumnya).
  select stok_minimum, lokasi into v_stok_minimum_asal, v_lokasi_asal
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  perform 1
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.ke_cabang_id
  for update;

  update stok
  set jumlah = jumlah + v_transfer.jumlah
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.ke_cabang_id;

  if not found then
    insert into stok (produk_id, cabang_id, jumlah, stok_minimum, lokasi)
    values (
      v_transfer.produk_id, v_transfer.ke_cabang_id, v_transfer.jumlah,
      coalesce(v_stok_minimum_asal, 0), coalesce(v_lokasi_asal, '')
    );
  end if;

  update transfer_stok
  set status = 'diterima',
      diterima_oleh = auth.uid(),
      diterima_oleh_nama = auth.email(),
      diterima_pada = now()
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Kalau ada transfer yang sudah dikirim ('terkirim') SEBELUM
--   migrasi ini dijalankan, jumlahnya SUDAH ditambahkan ke stok
--   tujuan lewat function lama. Migrasi ini set default status
--   baris LAMA jadi 'diterima' supaya tidak konflik / dobel hitung.
--   Kalau kamu tahu ada transfer yang sebetulnya masih dalam
--   perjalanan saat migrasi ini dijalankan, cek manual & sesuaikan
--   baris tersebut (ubah status jadi 'terkirim' DAN kurangi lagi
--   stok tujuan sejumlah yang sama, karena dulu sudah kadung
--   ditambahkan).
-- - Kolom `dibuat_oleh_nama` pada baris transfer LAMA akan kosong
--   (NULL) karena datanya tidak tersimpan dulu; UI menampilkan "—"
--   untuk baris yang datanya belum ada.
