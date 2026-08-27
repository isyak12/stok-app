-- =========================================================
-- Skema tambahan: Mutasi Stok (Barang Masuk/Pembelian & Keluar/Pemasangan)
-- + Lampiran (attachment) per mutasi
-- Jalankan setelah schema.sql & auth-policies.sql sudah ada
-- =========================================================

-- 1. Tabel mutasi_stok: mencatat setiap transaksi masuk/keluar
create table if not exists mutasi_stok (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  jenis text not null check (jenis in ('masuk', 'keluar')),
  jumlah integer not null check (jumlah > 0),
  keterangan text,               -- mis. "Pembelian dari CV Sumber Jaya" / "Pemasangan proyek A"
  tanggal date not null default current_date,
  dibuat_oleh uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_mutasi_stok_produk_id on mutasi_stok(produk_id);
create index if not exists idx_mutasi_stok_tanggal on mutasi_stok(tanggal);

-- 2. Tabel mutasi_lampiran: file bukti (nota, foto, dll), bisa lebih dari satu per mutasi
create table if not exists mutasi_lampiran (
  id uuid primary key default gen_random_uuid(),
  mutasi_id uuid not null references mutasi_stok(id) on delete cascade,
  file_path text not null,       -- path di Supabase Storage
  file_name text not null,
  file_type text,
  file_size bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_mutasi_lampiran_mutasi_id on mutasi_lampiran(mutasi_id);

-- 3. Trigger: otomatis update jumlah di tabel stok saat ada mutasi baru
create or replace function apply_mutasi_stok()
returns trigger as $$
begin
  if new.jenis = 'masuk' then
    update stok set jumlah = jumlah + new.jumlah
      where produk_id = new.produk_id;
  elsif new.jenis = 'keluar' then
    update stok set jumlah = jumlah - new.jumlah
      where produk_id = new.produk_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_mutasi_stok on mutasi_stok;
create trigger trg_apply_mutasi_stok
  after insert on mutasi_stok
  for each row execute function apply_mutasi_stok();

-- 4. RLS: hanya user login yang boleh akses (sejalan dengan auth-policies.sql)
alter table mutasi_stok enable row level security;
alter table mutasi_lampiran enable row level security;

drop policy if exists "mutasi_stok_select_authenticated" on mutasi_stok;
create policy "mutasi_stok_select_authenticated" on mutasi_stok
  for select using (auth.role() = 'authenticated');

drop policy if exists "mutasi_stok_insert_authenticated" on mutasi_stok;
create policy "mutasi_stok_insert_authenticated" on mutasi_stok
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "mutasi_lampiran_select_authenticated" on mutasi_lampiran;
create policy "mutasi_lampiran_select_authenticated" on mutasi_lampiran
  for select using (auth.role() = 'authenticated');

drop policy if exists "mutasi_lampiran_insert_authenticated" on mutasi_lampiran;
create policy "mutasi_lampiran_insert_authenticated" on mutasi_lampiran
  for insert with check (auth.role() = 'authenticated');

-- 5. Storage bucket untuk lampiran (jalankan sekali, boleh lewat dashboard juga)
-- Bucket dibuat PRIVATE (bukan public), akses lewat signed URL.
insert into storage.buckets (id, name, public)
values ('lampiran-mutasi', 'lampiran-mutasi', false)
on conflict (id) do nothing;

drop policy if exists "lampiran_mutasi_authenticated_all" on storage.objects;
create policy "lampiran_mutasi_authenticated_all" on storage.objects
  for all using (
    bucket_id = 'lampiran-mutasi' and auth.role() = 'authenticated'
  ) with check (
    bucket_id = 'lampiran-mutasi' and auth.role() = 'authenticated'
  );
