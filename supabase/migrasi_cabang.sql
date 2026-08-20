-- ============================================================
-- Migrasi: dukungan multi-cabang
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql dan transaksi_stok.sql.
--
-- File ini melengkapi apa yang sudah dibutuhkan kode aplikasi
-- (lib/storage.ts, lib/types.ts, komponen StokForm & TransaksiStokForm)
-- tapi belum ada di schema.sql / transaksi_stok.sql:
--   1. Tabel `cabang`
--   2. Kolom `cabang_id` di tabel `stok`
--   3. Ganti constraint unique produk_id -> unique(produk_id, cabang_id)
--   4. Ganti ulang function catat_transaksi_stok dengan parameter p_cabang_id
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel cabang
-- ------------------------------------------------------------
create table if not exists cabang (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kode text not null unique,
  dibuat_pada timestamptz not null default now()
);

alter table cabang enable row level security;

drop policy if exists "Izinkan semua akses cabang" on cabang;
create policy "Izinkan semua akses cabang"
  on cabang for all
  using (true)
  with check (true);

-- Data contoh: 1 cabang default, supaya data stok lama (kalau ada)
-- bisa langsung "dipindahkan" ke sini di langkah 2.
insert into cabang (nama, kode)
values ('Cabang Utama', 'PUSAT')
on conflict (kode) do nothing;

-- ------------------------------------------------------------
-- 2. Kolom cabang_id di tabel stok
-- ------------------------------------------------------------
alter table stok
  add column if not exists cabang_id uuid references cabang(id) on delete cascade;

-- Isi baris stok lama (yang belum punya cabang_id) dengan cabang default,
-- supaya tidak ada baris stok yatim setelah kolom diwajibkan NOT NULL.
update stok
set cabang_id = (select id from cabang where kode = 'PUSAT')
where cabang_id is null;

alter table stok
  alter column cabang_id set not null;

-- Constraint lama di schema.sql adalah unique(produk_id), yang berarti
-- hanya boleh 1 baris stok per produk. Untuk multi-cabang, 1 produk
-- boleh punya banyak baris stok asal cabang_id-nya beda.
alter table stok drop constraint if exists stok_produk_id_key;
drop index if exists stok_produk_id_key;

alter table stok
  drop constraint if exists stok_produk_id_cabang_id_key;
alter table stok
  add constraint stok_produk_id_cabang_id_key unique (produk_id, cabang_id);

create index if not exists idx_stok_cabang_id on stok(cabang_id);

-- ------------------------------------------------------------
-- 3. Function catat_transaksi_stok dengan parameter p_cabang_id
-- ------------------------------------------------------------
-- Drop dulu versi lama (signature beda -> tidak bisa langsung create or replace)
drop function if exists catat_transaksi_stok(uuid, text, integer, text);

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

  insert into transaksi_stok (produk_id, tipe, jumlah, catatan)
  values (p_produk_id, p_tipe, p_jumlah, p_catatan)
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ------------------------------------------------------------
-- Catatan
-- ------------------------------------------------------------
-- - Kalau Anda SUDAH menjalankan auth-policies.sql sebelumnya, jalankan
--   juga policy berikut supaya tabel cabang ikut diperketat (hanya user
--   login yang boleh akses):
--
--   drop policy if exists "Izinkan semua akses cabang" on cabang;
--   create policy "Hanya user login yang boleh akses cabang"
--     on cabang for all
--     using (auth.role() = 'authenticated')
--     with check (auth.role() = 'authenticated');
--
-- - Setelah migrasi ini, Anda bisa tambah cabang lain langsung lewat
--   SQL Editor atau Table Editor Supabase, misalnya:
--   insert into cabang (nama, kode) values ('Cabang Cabang Timur', 'TIMUR');
