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
-- Catatan
-- ============================================================
-- - Tabel ini BELUM dipakai di kode frontend (lib/storage.ts,
--   komponen, dsb) — belum ditemukan hook atau UI yang membaca/
--   menulis transfer_stok. Kalau sudah ada rencana fitur "Transfer
--   Stok Antar Cabang" di aplikasi, kemungkinan masih perlu:
--     1. Function Postgres (mirip catat_transaksi_stok) untuk
--        memindahkan jumlah antar 2 baris `stok` sekaligus mencatat
--        baris transfer_stok, supaya atomik (tidak ada kondisi di
--        mana stok berkurang di cabang asal tapi gagal bertambah
--        di cabang tujuan).
--     2. Hook di lib/storage.ts + form/komponen UI untuk memanggilnya.
-- - Kolom `dibuat_oleh` nullable dan belum diisi otomatis dari sisi
--   manapun yang kita temukan — kalau mau tercatat siapa yang input,
--   pastikan diisi dengan auth.uid() saat insert (lewat function
--   security definer, bukan langsung dari client).
