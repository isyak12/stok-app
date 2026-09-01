-- ============================================================
-- Migrasi: bukti foto (opsional, multi-file) pada stok opname
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- stok_opname.sql (butuh tabel stok_opname dan function
-- catat_stok_opname versi 5 parameter sudah ada).
--
-- Menambahkan:
-- 1. Tabel stok_opname_lampiran (1 opname -> banyak file, OPSIONAL
--    -- beda dari bukti transaksi yang wajib, karena opname yang
--    hasilnya "cocok" seringnya tidak perlu difoto).
-- 2. Update function catat_stok_opname supaya menerima
--    p_lampiran_urls (array text, opsional / boleh null) dan
--    menyimpannya sebagai baris-baris di stok_opname_lampiran.
--
-- Bucket Storage: SENGAJA numpang di bucket "bukti-transaksi" yang
-- sudah ada (lihat migrasi_bukti_transaksi_stok.sql) -- tidak perlu
-- bucket & policy storage baru, cukup prefix path "opname/..." di
-- dalam bucket yang sama supaya tidak campur dengan file bukti
-- transaksi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel lampiran (multi-file opsional per opname)
-- ------------------------------------------------------------
create table if not exists stok_opname_lampiran (
  id uuid primary key default gen_random_uuid(),
  opname_id uuid not null references stok_opname(id) on delete cascade,
  url text not null,
  dibuat_pada timestamptz not null default now()
);

create index if not exists idx_stok_opname_lampiran_opname_id
  on stok_opname_lampiran(opname_id);

alter table stok_opname_lampiran enable row level security;

drop policy if exists "Hanya user login yang boleh akses stok_opname_lampiran" on stok_opname_lampiran;
create policy "Hanya user login yang boleh akses stok_opname_lampiran"
  on stok_opname_lampiran for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 2. Update catat_stok_opname: tambah p_lampiran_urls (OPSIONAL)
-- ------------------------------------------------------------
-- drop dulu karena signature (jumlah parameter) berubah dari versi
-- 5 parameter di stok_opname.sql.
drop function if exists catat_stok_opname(uuid, uuid, integer, text, text);

create or replace function catat_stok_opname(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_stok_fisik integer,
  p_alasan text default null,
  p_catatan text default null,
  p_lampiran_urls text[] default null
)
returns stok_opname
language plpgsql
security definer
as $$
declare
  v_stok_sistem integer;
  v_selisih integer;
  v_transaksi_id uuid;
  v_opname stok_opname;
  v_catatan_transaksi text;
  v_url text;
begin
  if p_stok_fisik is null or p_stok_fisik < 0 then
    raise exception 'Stok fisik harus berupa angka 0 atau lebih';
  end if;

  select jumlah into v_stok_sistem
  from stok
  where produk_id = p_produk_id
    and cabang_id = p_cabang_id
  for update;

  if not found then
    raise exception 'Data stok untuk produk ini di cabang yang dipilih tidak ditemukan';
  end if;

  v_selisih := p_stok_fisik - v_stok_sistem;

  if v_selisih != 0 then
    if p_alasan is null or btrim(p_alasan) = '' then
      raise exception
        'Alasan wajib diisi kalau ada selisih antara stok fisik dan stok sistem';
    end if;

    -- PENTING (bugfix, lihat juga migrasi_wajib_bukti_opname_selisih.sql):
    -- flag ini wajib diset sebelum update stok.jumlah, kalau tidak
    -- akan ditolak trigger dari migrasi_kunci_jumlah_manual.sql.
    perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
    update stok
    set jumlah = p_stok_fisik
    where produk_id = p_produk_id
      and cabang_id = p_cabang_id;

    v_catatan_transaksi := 'Stok opname (' || p_alasan || ')'
      || case when p_catatan is not null and btrim(p_catatan) != ''
              then ': ' || p_catatan
              else '' end;

    insert into transaksi_stok (
      produk_id, cabang_id, tipe, jumlah, catatan,
      dibuat_oleh, dibuat_oleh_nama, pihak
    )
    values (
      p_produk_id, p_cabang_id,
      case when v_selisih > 0 then 'masuk' else 'keluar' end,
      abs(v_selisih),
      v_catatan_transaksi,
      auth.uid(), auth.email(), 'Stok Opname'
    )
    returning id into v_transaksi_id;
  end if;

  insert into stok_opname (
    produk_id, cabang_id, stok_sistem, stok_fisik, alasan, catatan,
    transaksi_id, dibuat_oleh, dibuat_oleh_nama
  )
  values (
    p_produk_id, p_cabang_id, v_stok_sistem, p_stok_fisik, p_alasan, p_catatan,
    v_transaksi_id, auth.uid(), auth.email()
  )
  returning * into v_opname;

  if p_lampiran_urls is not null then
    foreach v_url in array p_lampiran_urls
    loop
      insert into stok_opname_lampiran (opname_id, url)
      values (v_opname.id, v_url);
    end loop;
  end if;

  return v_opname;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Setelah migrasi ini, function catat_stok_opname LAMA (versi 5
--   parameter tanpa p_lampiran_urls) sudah tidak ada lagi. Pastikan
--   kode frontend (lib/storage.ts) diupdate BARENGAN dengan migrasi
--   ini, kalau tidak pencatatan opname akan gagal dengan error
--   "function does not exist".
-- - p_lampiran_urls OPSIONAL (boleh null / array kosong) -- beda dari
--   bukti transaksi yang wajib. Frontend upload file ke bucket
--   "bukti-transaksi" dengan prefix path "opname/..." dulu (dapat
--   public URL-nya), baru panggil RPC ini dengan array URL tersebut.
-- - Opname LAMA (sebelum migrasi ini) tidak akan punya baris di
--   stok_opname_lampiran. UI riwayat opname cukup tampilkan "Tidak
--   ada foto" untuk baris lama tersebut.
