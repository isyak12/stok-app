-- ============================================================
-- Transfer stok antar cabang: tabel transfer_stok
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, DAN migrasi_cabang.sql
-- (butuh tabel produk dan cabang sudah ada).
--
-- Catatan: file ini menuliskan ULANG struktur tabel transfer_stok
-- yang SUDAH berjalan di database production (dibuat manual
-- sebelumnya, belum ada file migrasinya di repo). Tujuannya supaya
-- kalau nanti perlu setup database baru dari nol, tabel ini ikut
-- terbuat otomatis dan skema di repo tetap sinkron dengan production.
-- ============================================================

create table if not exists transfer_stok (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  dari_cabang_id uuid not null references cabang(id),
  ke_cabang_id uuid not null references cabang(id),
  jumlah integer not null check (jumlah > 0),
  catatan text default ''::text,
  dibuat_pada timestamptz not null default now(),
  dibuat_oleh uuid references auth.users(id)
);

-- Index tambahan yang direkomendasikan (belum ada di production saat
-- ini — di sana baru ada index primary key). Berguna supaya query
-- riwayat transfer per produk / per cabang / urut tanggal tidak
-- full table scan seiring data bertambah banyak. Aman dijalankan
-- kapan saja, tidak mengubah data yang sudah ada.
create index if not exists idx_transfer_stok_produk_id
  on transfer_stok(produk_id);
create index if not exists idx_transfer_stok_dari_cabang_id
  on transfer_stok(dari_cabang_id);
create index if not exists idx_transfer_stok_ke_cabang_id
  on transfer_stok(ke_cabang_id);
create index if not exists idx_transfer_stok_dibuat_pada
  on transfer_stok(dibuat_pada desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table transfer_stok enable row level security;

drop policy if exists "Hanya user login yang boleh akses transfer_stok" on transfer_stok;
create policy "Hanya user login yang boleh akses transfer_stok"
  on transfer_stok for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- Function untuk mencatat transfer stok antar cabang secara atomik.
--
-- Memindahkan `p_jumlah` unit produk dari cabang asal ke cabang
-- tujuan: mengurangi baris stok di cabang asal, menambah (atau
-- membuat baru) baris stok di cabang tujuan, lalu mencatat baris
-- transfer_stok — semuanya dalam satu transaksi Postgres sehingga
-- tidak mungkin "stok berkurang di asal tapi gagal bertambah di
-- tujuan" (partial failure). Baris stok asal & tujuan dikunci
-- (`for update`) supaya aman dari race condition kalau ada transfer
-- lain berjalan bersamaan untuk produk+cabang yang sama.
-- ============================================================
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
  v_stok_minimum_asal integer;
  v_lokasi_asal text;
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
  select jumlah, stok_minimum, lokasi
    into v_stok_asal, v_stok_minimum_asal, v_lokasi_asal
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

  -- Kunci juga baris stok cabang tujuan kalau sudah ada, supaya
  -- transfer lain yang bersamaan ke cabang tujuan yang sama tidak
  -- saling tabrakan saat update jumlah.
  perform 1
  from stok
  where produk_id = p_produk_id
    and cabang_id = p_ke_cabang_id
  for update;

  update stok
  set jumlah = jumlah - p_jumlah
  where produk_id = p_produk_id
    and cabang_id = p_dari_cabang_id;

  update stok
  set jumlah = jumlah + p_jumlah
  where produk_id = p_produk_id
    and cabang_id = p_ke_cabang_id;

  if not found then
    -- Produk ini belum punya baris stok di cabang tujuan -> buat baru.
    -- stok_minimum & lokasi ikut nilai cabang asal sebagai titik awal
    -- yang wajar; bisa diubah lagi lewat form Ubah Barang di cabang
    -- tujuan kalau perlu.
    insert into stok (produk_id, cabang_id, jumlah, stok_minimum, lokasi)
    values (p_produk_id, p_ke_cabang_id, p_jumlah, v_stok_minimum_asal, v_lokasi_asal);
  end if;

  insert into transfer_stok (produk_id, dari_cabang_id, ke_cabang_id, jumlah, catatan, dibuat_oleh)
  values (p_produk_id, p_dari_cabang_id, p_ke_cabang_id, p_jumlah, p_catatan, auth.uid())
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Dipanggil dari frontend lewat lib/storage.ts (hook useTransferStok),
--   komponen TransferStokForm/TransferStokTable, dan halaman
--   app/(dashboard)/stok/[id]/transfer.
-- - Kolom `dibuat_oleh` diisi otomatis dari auth.uid() di dalam
--   function catat_transfer_stok (security definer) — bukan dikirim
--   dari client, supaya tidak bisa dipalsukan.
