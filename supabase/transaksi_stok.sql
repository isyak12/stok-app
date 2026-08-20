-- ============================================================
-- Riwayat transaksi stok: tabel transaksi_stok + function
-- catat_transaksi_stok untuk mencatat barang masuk/keluar.
-- Jalankan file ini di Supabase Dashboard > SQL Editor
-- (setelah schema.sql).
--
-- !! PENTING: function catat_transaksi_stok(p_produk_id, p_tipe, ...)
-- di file ini BELUM mendukung multi-cabang (belum ada p_cabang_id).
-- Kode aplikasi (lib/storage.ts) SELALU memanggil versi yang punya
-- p_cabang_id. Jadi file supabase/migrasi_cabang.sql WAJIB dijalankan
-- setelah file ini — bukan opsional — karena file itu men-drop &
-- membuat ulang function ini dengan signature yang benar. Kalau
-- terlewat, RPC dari aplikasi akan gagal (function tidak ditemukan)
-- atau salah mengambil baris stok saat produk punya banyak cabang.
-- ============================================================

create table if not exists transaksi_stok (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  tipe text not null check (tipe in ('masuk', 'keluar')),
  jumlah integer not null check (jumlah > 0),
  catatan text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists idx_transaksi_stok_produk_id
  on transaksi_stok(produk_id);
create index if not exists idx_transaksi_stok_dibuat_pada
  on transaksi_stok(dibuat_pada desc);

-- Function untuk mencatat transaksi stok masuk/keluar sekaligus
-- memperbarui jumlah di tabel stok. Menolak (raise exception) bila
-- stok keluar melebihi jumlah stok yang tersedia.
create or replace function catat_transaksi_stok(
  p_produk_id uuid,
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

  select jumlah into v_stok_sekarang
  from stok
  where produk_id = p_produk_id
  for update;

  if not found then
    raise exception 'Data stok untuk produk ini tidak ditemukan';
  end if;

  if p_tipe = 'keluar' and v_stok_sekarang < p_jumlah then
    raise exception
      'Stok tidak cukup. Stok saat ini % , diminta %',
      v_stok_sekarang, p_jumlah;
  end if;

  update stok
  set jumlah = jumlah + case when p_tipe = 'masuk' then p_jumlah else -p_jumlah end
  where produk_id = p_produk_id;

  insert into transaksi_stok (produk_id, tipe, jumlah, catatan)
  values (p_produk_id, p_tipe, p_jumlah, p_catatan)
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table transaksi_stok enable row level security;

-- Prototipe / belum pakai login (samakan dengan schema.sql):
drop policy if exists "Izinkan semua akses transaksi_stok" on transaksi_stok;
create policy "Izinkan semua akses transaksi_stok"
  on transaksi_stok for all
  using (true)
  with check (true);

-- SUDAH MENAMBAHKAN LOGIN? Ganti policy di atas dengan versi ini
-- (samakan dengan auth-policies.sql):
--
-- drop policy if exists "Izinkan semua akses transaksi_stok" on transaksi_stok;
-- create policy "Hanya user login yang boleh akses transaksi_stok"
--   on transaksi_stok for all
--   using (auth.role() = 'authenticated')
--   with check (auth.role() = 'authenticated');
