-- ============================================================
-- Migrasi: Log Aktivitas Barang -- jejak audit otomatis untuk
-- SIAPA yang menambahkan barang baru, menghapus barang, atau
-- mengurangi jumlah stok.
--
-- Kenapa lewat TRIGGER (bukan dicatat manual dari lib/storage.ts)?
-- Supaya tidak mungkin lupa/terlewat dicatat -- setiap jalur yang
-- mengubah tabel produk/stok otomatis tercatat, termasuk transaksi
-- keluar, transfer antar cabang, koreksi stok opname, MAUPUN edit
-- manual langsung dari form Ubah Barang.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, migrasi_cabang.sql, dan role-policies.sql /
-- migrasi_superadmin.sql (butuh saya_admin()).
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel log_aktivitas_barang
-- ------------------------------------------------------------
-- produk_id SENGAJA TANPA foreign key ke produk(id): saat produk
-- dihapus, baris log "hapus" untuk produk itu harus tetap ada
-- (kalau pakai FK biasa akan ikut terhapus cascade, kalau FK
-- "on delete set null" id-nya hilang tapi itu masih oke -- namun
-- tanpa FK sama sekali lebih sederhana dan bebas dari race
-- condition trigger vs constraint).
create table if not exists log_aktivitas_barang (
  id uuid primary key default gen_random_uuid(),
  aksi text not null check (aksi in ('tambah', 'hapus', 'kurangi')),
  produk_id uuid,
  produk_nama text not null,
  produk_sku text not null,
  cabang_id uuid,
  cabang_nama text,
  jumlah integer,
  keterangan text,
  dilakukan_oleh uuid,
  dilakukan_oleh_nama text,
  dilakukan_pada timestamptz not null default now()
);

create index if not exists idx_log_aktivitas_barang_pada
  on log_aktivitas_barang (dilakukan_pada desc);
create index if not exists idx_log_aktivitas_barang_produk
  on log_aktivitas_barang (produk_id);

alter table log_aktivitas_barang enable row level security;

-- Hanya admin/superadmin yang boleh melihat log (samakan dengan
-- pembatasan menu "Log Aktivitas" di components/Sidebar.tsx).
-- Tidak ada policy insert/update/delete untuk role biasa -- baris
-- HANYA ditambahkan lewat trigger di bawah (security definer),
-- bukan langsung dari client.
drop policy if exists "Admin boleh lihat log aktivitas barang" on log_aktivitas_barang;
create policy "Admin boleh lihat log aktivitas barang"
  on log_aktivitas_barang for select
  using (saya_admin());

-- ------------------------------------------------------------
-- 2. Trigger: catat saat produk baru ditambahkan
-- ------------------------------------------------------------
create or replace function log_tambah_produk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into log_aktivitas_barang (
    aksi, produk_id, produk_nama, produk_sku,
    dilakukan_oleh, dilakukan_oleh_nama
  )
  values (
    'tambah', new.id, new.nama, new.sku,
    auth.uid(), auth.email()
  );
  return new;
end;
$$;

drop trigger if exists trg_log_tambah_produk on produk;
create trigger trg_log_tambah_produk
after insert on produk
for each row execute function log_tambah_produk();

-- ------------------------------------------------------------
-- 3. Trigger: catat saat produk dihapus
-- ------------------------------------------------------------
-- BEFORE DELETE (bukan AFTER) supaya baris di tabel `stok` masih
-- ada saat kita jumlahkan total stok terakhir -- ON DELETE CASCADE
-- ke tabel stok baru benar-benar terjadi setelah baris produk ini
-- selesai dihapus.
create or replace function log_hapus_produk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_stok integer;
begin
  select coalesce(sum(jumlah), 0) into v_total_stok
  from stok
  where produk_id = old.id;

  insert into log_aktivitas_barang (
    aksi, produk_id, produk_nama, produk_sku, jumlah,
    keterangan, dilakukan_oleh, dilakukan_oleh_nama
  )
  values (
    'hapus', old.id, old.nama, old.sku, v_total_stok,
    'Sisa total stok gabungan semua cabang saat dihapus: ' || v_total_stok,
    auth.uid(), auth.email()
  );
  return old;
end;
$$;

drop trigger if exists trg_log_hapus_produk on produk;
create trigger trg_log_hapus_produk
before delete on produk
for each row execute function log_hapus_produk();

-- ------------------------------------------------------------
-- 4. Trigger: catat setiap kali jumlah stok BERKURANG
-- ------------------------------------------------------------
-- Mencakup SEMUA jalur pengurangan stok: transaksi keluar
-- (catat_transaksi_stok), transfer ke cabang lain
-- (catat_transfer_stok), koreksi stok opname yang hasilnya minus
-- (catat_stok_opname), maupun edit manual langsung dari form Ubah
-- Barang. Kenaikan jumlah (masuk/opname plus) TIDAK dicatat di sini
-- -- fokus fitur ini adalah pengurangan/kehilangan barang.
create or replace function log_kurangi_stok()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produk record;
  v_cabang_nama text;
begin
  if new.jumlah < old.jumlah then
    select nama, sku into v_produk from produk where id = new.produk_id;
    select nama into v_cabang_nama from cabang where id = new.cabang_id;

    insert into log_aktivitas_barang (
      aksi, produk_id, produk_nama, produk_sku,
      cabang_id, cabang_nama, jumlah,
      keterangan, dilakukan_oleh, dilakukan_oleh_nama
    )
    values (
      'kurangi', new.produk_id,
      coalesce(v_produk.nama, '(produk tidak ditemukan)'),
      coalesce(v_produk.sku, '-'),
      new.cabang_id, v_cabang_nama,
      old.jumlah - new.jumlah,
      'Stok berkurang dari ' || old.jumlah || ' menjadi ' || new.jumlah,
      auth.uid(), auth.email()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_kurangi_stok on stok;
create trigger trg_log_kurangi_stok
after update on stok
for each row execute function log_kurangi_stok();

-- ============================================================
-- Catatan
-- ============================================================
-- - Kolom cabang_id di tabel `stok` baru ada setelah
--   migrasi_cabang.sql. Kalau project Anda belum menjalankan
--   migrasi itu, jalankan dulu sebelum file ini.
-- - dilakukan_oleh_nama berisi EMAIL INTERNAL (mis.
--   "budi@stokku.local"), sama seperti dibuat_oleh_nama di
--   transaksi_stok/transfer_stok -- gunakan emailKeUsername() di
--   frontend (lib/username.ts) untuk menampilkan username-nya saja.
-- - Trigger berjalan SECURITY DEFINER supaya tetap bisa menulis ke
--   log_aktivitas_barang meski staf/admin biasa tidak diberi hak
--   INSERT langsung ke tabel itu (lihat policy di bagian 1).
