-- ============================================================
-- Migrasi: catat cabang di riwayat transaksi stok (masuk/keluar)
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- migrasi_cabang.sql (butuh tabel `cabang` dan kolom `stok.cabang_id`
-- sudah ada).
--
-- Masalah yang diperbaiki: function catat_transaksi_stok sudah
-- menerima p_cabang_id (dipakai untuk update baris `stok` yang
-- benar), TAPI cabang itu tidak pernah ikut disimpan ke tabel
-- transaksi_stok. Akibatnya riwayat transaksi masuk/keluar tidak
-- bisa menunjukkan terjadi di cabang mana — beda dengan
-- transfer_stok yang sudah mencatat dari_cabang_id/ke_cabang_id.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolom cabang_id di tabel transaksi_stok
-- ------------------------------------------------------------
alter table transaksi_stok
  add column if not exists cabang_id uuid references cabang(id);

-- Isi baris lama (kalau ada, sebelum migrasi ini) dengan cabang
-- default, supaya data lama tidak tampil kosong di UI.
update transaksi_stok
set cabang_id = (select id from cabang where kode = 'PUSAT')
where cabang_id is null;

alter table transaksi_stok
  alter column cabang_id set not null;

create index if not exists idx_transaksi_stok_cabang_id
  on transaksi_stok(cabang_id);

-- ------------------------------------------------------------
-- 2. Ganti ulang function catat_transaksi_stok supaya ikut
--    menyimpan cabang_id ke baris transaksi_stok yang dicatat.
-- ------------------------------------------------------------
create or replace function catat_transaksi_stok(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_tipe text,
  p_jumlah integer,
  p_catatan text default null
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

  -- PENTING: cabang_id ikut disimpan di sini (sebelumnya tidak,
  -- sehingga riwayat transaksi tidak bisa menunjukkan cabang mana).
  insert into transaksi_stok (produk_id, cabang_id, tipe, jumlah, catatan)
  values (p_produk_id, p_cabang_id, p_tipe, p_jumlah, p_catatan)
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ------------------------------------------------------------
-- Catatan
-- ------------------------------------------------------------
-- Signature function TIDAK berubah (masih sama urutan & tipe
-- parameter seperti versi migrasi_cabang.sql), jadi tidak perlu
-- `drop function` dulu — `create or replace` cukup.
