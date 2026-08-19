-- ============================================================
-- Skema database Stokku: tabel produk & stok
-- Jalankan file ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabel produk: data master barang (tidak berubah-ubah)
create table if not exists produk (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  nama text not null,
  kategori text not null default 'Lainnya',
  satuan text not null default 'pcs',
  harga_beli numeric(14, 2) not null default 0,
  harga_jual numeric(14, 2) not null default 0,
  dibuat_pada timestamptz not null default now()
);

-- Tabel stok: jumlah & lokasi persediaan per produk
-- (1 produk = 1 baris stok. Dipisah dari produk supaya nanti
--  mudah dikembangkan jadi multi-lokasi/multi-gudang bila perlu.)
create table if not exists stok (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  jumlah integer not null default 0,
  stok_minimum integer not null default 0,
  lokasi text not null default '',
  diperbarui_pada timestamptz not null default now(),
  unique (produk_id)
);

create index if not exists idx_stok_produk_id on stok(produk_id);

-- Otomatis perbarui kolom diperbarui_pada setiap kali baris stok diubah
create or replace function set_diperbarui_pada()
returns trigger as $$
begin
  new.diperbarui_pada = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stok_diperbarui on stok;
create trigger trg_stok_diperbarui
before update on stok
for each row execute function set_diperbarui_pada();

-- ============================================================
-- Row Level Security
-- ============================================================
-- Supabase mewajibkan RLS. Policy di bawah ini mengizinkan semua
-- operasi (baca/tulis) memakai anon key, cocok untuk memulai/prototipe.
-- SUDAH MENAMBAHKAN LOGIN? Jalankan supabase/auth-policies.sql setelah
-- ini untuk memperketat akses hanya untuk user yang sudah masuk.

alter table produk enable row level security;
alter table stok enable row level security;

drop policy if exists "Izinkan semua akses produk" on produk;
create policy "Izinkan semua akses produk"
  on produk for all
  using (true)
  with check (true);

drop policy if exists "Izinkan semua akses stok" on stok;
create policy "Izinkan semua akses stok"
  on stok for all
  using (true)
  with check (true);
