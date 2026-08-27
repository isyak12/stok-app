-- ============================================================
-- Migrasi: bukti foto penerimaan pada transfer stok
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transfer_stok.sql, DAN mutasi_detail.sql (butuh
-- tabel transfer_stok dan function konfirmasi_terima_transfer
-- sudah ada).
--
-- Menambahkan:
-- 1. Kolom bukti_foto_url & catatan_penerimaan di transfer_stok.
-- 2. Storage bucket "bukti-transfer" (public read, upload hanya
--    untuk user login) untuk menyimpan foto bukti penerimaan.
-- 3. Update function konfirmasi_terima_transfer supaya menerima
--    & menyimpan URL foto (WAJIB diisi) + catatan penerimaan
--    (opsional).
-- ============================================================

-- ============================================================
-- 1. Kolom baru di transfer_stok
-- ============================================================
alter table transfer_stok
  add column if not exists bukti_foto_url text,
  add column if not exists catatan_penerimaan text;

-- ============================================================
-- 2. Storage bucket untuk foto bukti penerimaan
-- ============================================================
-- Bucket dibuat "public" supaya foto bisa ditampilkan langsung
-- lewat public URL (getPublicUrl) tanpa perlu generate signed URL
-- tiap kali render tabel riwayat transfer. Ini aman untuk kasus
-- ini karena foto bukti penerimaan bukan data sensitif/rahasia —
-- sama seperti pola akses lain di aplikasi ini yang mengandalkan
-- login di level aplikasi (middleware), bukan kerahasiaan URL.
insert into storage.buckets (id, name, public)
values ('bukti-transfer', 'bukti-transfer', true)
on conflict (id) do nothing;

-- Hanya user yang sudah login yang boleh upload ke bucket ini.
drop policy if exists "Hanya user login boleh upload bukti transfer" on storage.objects;
create policy "Hanya user login boleh upload bukti transfer"
  on storage.objects for insert
  with check (
    bucket_id = 'bukti-transfer'
    and auth.role() = 'authenticated'
  );

-- Siapa saja (termasuk anon) boleh membaca objek di bucket ini —
-- diperlukan supaya <img src="..."> di tabel riwayat transfer bisa
-- memuat foto lewat public URL. Sejalan dengan bucket public di atas.
drop policy if exists "Semua orang boleh lihat bukti transfer" on storage.objects;
create policy "Semua orang boleh lihat bukti transfer"
  on storage.objects for select
  using (bucket_id = 'bukti-transfer');

-- ============================================================
-- 3. Update konfirmasi_terima_transfer: wajib foto + catatan opsional
-- ============================================================
-- drop dulu karena signature (jumlah parameter) berubah dari versi
-- di mutasi_detail.sql.
drop function if exists konfirmasi_terima_transfer(uuid);

create or replace function konfirmasi_terima_transfer(
  p_transfer_id uuid,
  p_bukti_foto_url text,
  p_catatan_penerimaan text default null
)
returns transfer_stok
language plpgsql
security definer
as $$
declare
  v_transfer transfer_stok;
  v_stok_minimum_asal integer;
  v_lokasi_asal text;
begin
  if p_bukti_foto_url is null or length(trim(p_bukti_foto_url)) = 0 then
    raise exception 'Bukti foto penerimaan wajib diunggah';
  end if;

  select * into v_transfer
  from transfer_stok
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer tidak ditemukan';
  end if;

  if v_transfer.status = 'diterima' then
    raise exception 'Transfer ini sudah dikonfirmasi diterima sebelumnya';
  end if;

  -- Ambil stok_minimum & lokasi cabang asal sebagai titik awal yang
  -- wajar kalau produk ini belum pernah ada baris stok di cabang
  -- tujuan (sama seperti perilaku sebelumnya).
  select stok_minimum, lokasi into v_stok_minimum_asal, v_lokasi_asal
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  perform 1
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.ke_cabang_id
  for update;

  update stok
  set jumlah = jumlah + v_transfer.jumlah
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.ke_cabang_id;

  if not found then
    insert into stok (produk_id, cabang_id, jumlah, stok_minimum, lokasi)
    values (
      v_transfer.produk_id, v_transfer.ke_cabang_id, v_transfer.jumlah,
      coalesce(v_stok_minimum_asal, 0), coalesce(v_lokasi_asal, '')
    );
  end if;

  update transfer_stok
  set status = 'diterima',
      diterima_oleh = auth.uid(),
      diterima_oleh_nama = auth.email(),
      diterima_pada = now(),
      bukti_foto_url = p_bukti_foto_url,
      catatan_penerimaan = nullif(trim(p_catatan_penerimaan), '')
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Setelah migrasi ini, function konfirmasi_terima_transfer LAMA
--   (hanya 1 parameter p_transfer_id) sudah tidak ada lagi. Pastikan
--   kode frontend (lib/storage.ts) sudah diupdate BARENGAN dengan
--   migrasi ini, kalau tidak konfirmasi terima transfer akan gagal
--   dengan error "function does not exist".
-- - Transfer LAMA yang sudah berstatus 'diterima' SEBELUM migrasi
--   ini akan punya bukti_foto_url = NULL. Ini tidak masalah — UI
--   cukup menampilkan "Tidak ada foto" untuk baris lama tersebut.
-- - Kalau nanti perlu batasi ukuran file upload, itu diatur di sisi
--   frontend (lib/storage.ts) sebelum upload, bukan di function ini.
