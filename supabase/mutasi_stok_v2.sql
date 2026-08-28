-- ============================================================
-- Migrasi (disesuaikan): trigger + RLS untuk tabel mutasi_stok
-- yang SUDAH ADA di database kamu, dengan struktur kolom:
--   id, produk_id, jenis, jumlah, keterangan, tanggal, dibuat_oleh, created_at
-- Jalankan file ini di Supabase Dashboard > SQL Editor.
-- ============================================================

-- Pastikan kolom penting sudah punya constraint yang benar
-- (aman dijalankan walau constraint sudah ada, akan diabaikan bila duplikat)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mutasi_stok_jenis_check'
  ) then
    alter table mutasi_stok
      add constraint mutasi_stok_jenis_check check (jenis in ('masuk', 'keluar'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'mutasi_stok_jumlah_check'
  ) then
    alter table mutasi_stok
      add constraint mutasi_stok_jumlah_check check (jumlah > 0);
  end if;
end $$;

create index if not exists idx_mutasi_stok_produk_id on mutasi_stok(produk_id);
create index if not exists idx_mutasi_stok_created_at on mutasi_stok(created_at desc);

-- ============================================================
-- Trigger: otomatis perbarui stok.jumlah setiap ada mutasi baru
-- ============================================================
create or replace function terapkan_mutasi_stok()
returns trigger as $$
declare
  jumlah_sekarang integer;
begin
  select jumlah into jumlah_sekarang from stok where produk_id = new.produk_id;

  if jumlah_sekarang is null then
    raise exception 'Baris stok untuk produk_id % belum ada. Tambahkan barang lewat form "Tambah Barang" terlebih dahulu.', new.produk_id;
  end if;

  if new.jenis = 'masuk' then
    update stok set jumlah = jumlah + new.jumlah where produk_id = new.produk_id;
  else -- 'keluar'
    if jumlah_sekarang < new.jumlah then
      raise exception 'Stok tidak mencukupi. Sisa stok saat ini: %, diminta keluar: %', jumlah_sekarang, new.jumlah;
    end if;
    update stok set jumlah = jumlah - new.jumlah where produk_id = new.produk_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mutasi_stok on mutasi_stok;
create trigger trg_mutasi_stok
after insert on mutasi_stok
for each row execute function terapkan_mutasi_stok();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table mutasi_stok enable row level security;

drop policy if exists "User login bisa lihat mutasi" on mutasi_stok;
create policy "User login bisa lihat mutasi"
  on mutasi_stok for select
  to authenticated
  using (true);

drop policy if exists "User login bisa tambah mutasi" on mutasi_stok;
create policy "User login bisa tambah mutasi"
  on mutasi_stok for insert
  to authenticated
  with check (auth.uid() = dibuat_oleh);

-- Catatan: sengaja TIDAK dibuat policy UPDATE/DELETE, supaya riwayat
-- mutasi tidak bisa diubah dari aplikasi (integritas audit trail).
