-- ============================================================
-- Migrasi: bukti (foto/dokumen) pada transaksi stok masuk/keluar
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, migrasi_cabang.sql, DAN
-- migrasi_tanggal_manual_transaksi.sql (butuh tabel transaksi_stok
-- dan function catat_transaksi_stok versi 8 parameter sudah ada).
--
-- Menambahkan:
-- 1. Tabel transaksi_stok_lampiran (1 transaksi -> banyak file,
--    karena attachment di sini WAJIB dan boleh lebih dari satu).
-- 2. Storage bucket "bukti-transaksi" (public read, upload hanya
--    untuk user login) untuk menyimpan file bukti transaksi.
-- 3. Update function catat_transaksi_stok supaya menerima
--    p_lampiran_urls (array text, WAJIB minimal 1 item) dan
--    menyimpannya sebagai baris-baris di transaksi_stok_lampiran.
--
-- Pola bucket public & policy di sini sengaja disamakan dengan
-- migrasi_bukti_penerimaan.sql (bucket "bukti-transfer") supaya
-- konsisten satu aplikasi.
-- ============================================================

-- ============================================================
-- 1. Tabel lampiran (multi-file per transaksi)
-- ============================================================
create table if not exists transaksi_stok_lampiran (
  id uuid primary key default gen_random_uuid(),
  transaksi_id uuid not null references transaksi_stok(id) on delete cascade,
  url text not null,
  nama_file text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists idx_transaksi_stok_lampiran_transaksi_id
  on transaksi_stok_lampiran(transaksi_id);

alter table transaksi_stok_lampiran enable row level security;

-- Prototipe / belum pakai login (samakan dengan schema.sql).
-- SUDAH MENAMBAHKAN LOGIN? Ganti policy ini dengan versi
-- "auth.role() = 'authenticated'" (samakan dengan auth-policies.sql).
drop policy if exists "Izinkan semua akses transaksi_stok_lampiran" on transaksi_stok_lampiran;
create policy "Izinkan semua akses transaksi_stok_lampiran"
  on transaksi_stok_lampiran for all
  using (true)
  with check (true);

-- ============================================================
-- 2. Storage bucket untuk bukti transaksi
-- ============================================================
-- Public: sama seperti bucket bukti-transfer, supaya bisa
-- ditampilkan langsung lewat public URL tanpa signed URL. Bukan
-- data rahasia, dan akses aplikasi sudah dijaga di level login
-- (middleware), bukan lewat kerahasiaan URL.
insert into storage.buckets (id, name, public)
values ('bukti-transaksi', 'bukti-transaksi', true)
on conflict (id) do nothing;

drop policy if exists "Hanya user login boleh upload bukti transaksi" on storage.objects;
create policy "Hanya user login boleh upload bukti transaksi"
  on storage.objects for insert
  with check (
    bucket_id = 'bukti-transaksi'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Semua orang boleh lihat bukti transaksi" on storage.objects;
create policy "Semua orang boleh lihat bukti transaksi"
  on storage.objects for select
  using (bucket_id = 'bukti-transaksi');

-- ============================================================
-- 3. Update catat_transaksi_stok: tambah p_lampiran_urls (WAJIB)
-- ============================================================
-- drop dulu karena signature (jumlah parameter) berubah dari versi
-- 8 parameter di migrasi_tanggal_manual_transaksi.sql.
drop function if exists catat_transaksi_stok(
  uuid, uuid, text, integer, text, text, text, timestamptz
);

create or replace function catat_transaksi_stok(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_tipe text,
  p_jumlah integer,
  p_lampiran_urls text[],
  p_catatan text default null,
  p_pihak text default null,
  p_no_referensi text default null,
  p_dibuat_pada timestamptz default null
)
returns transaksi_stok
language plpgsql
security definer
as $$
declare
  v_stok_sekarang integer;
  v_transaksi transaksi_stok;
  v_dibuat_pada timestamptz;
  v_url text;
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

  -- Bukti wajib diisi minimal 1 file untuk semua transaksi.
  if p_lampiran_urls is null or array_length(p_lampiran_urls, 1) is null
     or array_length(p_lampiran_urls, 1) < 1 then
    raise exception 'Bukti (foto/dokumen) wajib diunggah minimal 1 file';
  end if;

  v_dibuat_pada := coalesce(p_dibuat_pada, now());

  if v_dibuat_pada > now() then
    raise exception 'Tanggal & waktu transaksi tidak boleh di masa depan';
  end if;

  if v_dibuat_pada < now() - interval '30 days' then
    raise exception 'Tanggal & waktu transaksi paling jauh mundur 30 hari dari sekarang';
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

  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
  update stok
  set jumlah = jumlah + case when p_tipe = 'masuk' then p_jumlah else -p_jumlah end
  where produk_id = p_produk_id
    and cabang_id = p_cabang_id;

  insert into transaksi_stok (
    produk_id, cabang_id, tipe, jumlah, catatan,
    dibuat_oleh, dibuat_oleh_nama, pihak, no_referensi, dibuat_pada
  )
  values (
    p_produk_id, p_cabang_id, p_tipe, p_jumlah, p_catatan,
    auth.uid(), auth.email(), p_pihak, p_no_referensi, v_dibuat_pada
  )
  returning * into v_transaksi;

  foreach v_url in array p_lampiran_urls
  loop
    insert into transaksi_stok_lampiran (transaksi_id, url)
    values (v_transaksi.id, v_url);
  end loop;

  return v_transaksi;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Setelah migrasi ini, function catat_transaksi_stok LAMA (versi
--   tanpa p_lampiran_urls) sudah tidak ada lagi. Pastikan kode
--   frontend (lib/storage.ts) diupdate BARENGAN dengan migrasi ini,
--   kalau tidak pencatatan transaksi akan gagal dengan error
--   "function does not exist".
-- - p_lampiran_urls WAJIB diisi array berisi minimal 1 URL. Frontend
--   harus upload file ke bucket "bukti-transaksi" dulu (dapat public
--   URL-nya), baru panggil RPC ini dengan array URL tersebut.
-- - Transaksi LAMA (sebelum migrasi ini) tidak akan punya baris di
--   transaksi_stok_lampiran. UI riwayat transaksi cukup tampilkan
--   "Tidak ada lampiran" untuk baris lama tersebut.
-- - Kalau nanti perlu batasi ukuran/tipe file upload, itu diatur di
--   sisi frontend (lib/storage.ts) sebelum upload, bukan di function
--   ini.
