-- ============================================================
-- Stok opname (rekonsiliasi fisik): alur untuk mencocokkan stok
-- sistem dengan hitungan fisik gudang, lalu mencatat selisihnya
-- (kalau ada) sebagai transaksi penyesuaian dengan alasan.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- schema.sql, transaksi_stok.sql, migrasi_cabang.sql,
-- migrasi_transaksi_cabang.sql, DAN mutasi_detail.sql (butuh
-- function catat_transaksi_stok versi terbaru & kolom-kolom
-- detailnya sudah ada, karena opname menyisipkan baris langsung ke
-- transaksi_stok dengan bentuk yang sama).
--
-- Kebutuhan yang ditutup: sebelum ini, tidak ada alur khusus untuk
-- "hitung fisik gudang lalu cocokkan ke sistem" — staf harus tahu
-- sendiri berapa selisihnya dan mencatatnya lewat form Transaksi
-- Stok biasa (rawan lupa / salah arah masuk-keluar), dan tidak ada
-- catatan kapan terakhir stok suatu produk+cabang benar-benar
-- dihitung fisik.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel stok_opname: satu baris per sesi hitung fisik
--    (satu produk, satu cabang, satu waktu).
-- ------------------------------------------------------------
-- stok_sistem: jumlah menurut sistem SAAT opname dilakukan (snapshot,
--   diambil di dalam function di bawah -- bukan dikirim dari client,
--   supaya tidak bisa dipalsukan / basi kalau ada mutasi lain
--   sebelum submit).
-- stok_fisik: hasil hitung manual staf di gudang.
-- selisih: kolom generated (stok_fisik - stok_sistem), tinggal dibaca
--   untuk tahu arah & besar penyesuaian tanpa hitung ulang di client.
-- alasan: kategori bebas teks (mis. 'rusak', 'hilang', 'salah_catat',
--   'lainnya') -- WAJIB diisi kalau selisih != 0, lihat function.
--   Boleh kosong kalau selisih = 0 (opname cocok, tidak ada apa-apa
--   untuk dijelaskan).
-- transaksi_id: referensi ke baris transaksi_stok penyesuaian yang
--   dibuat otomatis kalau selisih != 0. NULL kalau selisih = 0
--   (tidak ada penyesuaian, cuma catatan "sudah dicek, cocok").
--   Karena ini baris transaksi_stok biasa, fitur batalkan transaksi
--   (supabase/pembatalan_transaksi.sql) otomatis berlaku juga untuk
--   penyesuaian opname -- tidak perlu function batal terpisah.
create table if not exists stok_opname (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  cabang_id uuid not null references cabang(id),
  stok_sistem integer not null,
  stok_fisik integer not null check (stok_fisik >= 0),
  selisih integer generated always as (stok_fisik - stok_sistem) stored,
  alasan text,
  catatan text,
  transaksi_id uuid references transaksi_stok(id),
  dibuat_oleh uuid references auth.users(id),
  dibuat_oleh_nama text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists idx_stok_opname_produk_id
  on stok_opname(produk_id);
create index if not exists idx_stok_opname_cabang_id
  on stok_opname(cabang_id);
create index if not exists idx_stok_opname_dibuat_pada
  on stok_opname(dibuat_pada desc);

alter table stok_opname enable row level security;

drop policy if exists "Hanya user login yang boleh akses stok_opname" on stok_opname;
create policy "Hanya user login yang boleh akses stok_opname"
  on stok_opname for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 2. Function: catat sesi stok opname untuk satu produk+cabang.
-- ------------------------------------------------------------
-- Alur:
-- 1. Kunci & baca stok sistem saat ini (for update).
-- 2. Hitung selisih = stok_fisik - stok_sistem.
-- 3. Kalau selisih = 0: cuma simpan baris stok_opname sebagai bukti
--    "sudah dicek, cocok" -- tidak menyentuh tabel stok atau
--    transaksi_stok sama sekali.
-- 4. Kalau selisih != 0: wajib ada p_alasan (raise exception kalau
--    kosong). Set stok langsung ke p_stok_fisik, catat baris
--    transaksi_stok penyesuaian (tipe 'masuk' kalau fisik > sistem,
--    'keluar' kalau fisik < sistem, jumlah = abs(selisih), pihak =
--    'Stok Opname', catatan = alasan + catatan tambahan), lalu simpan
--    baris stok_opname dengan transaksi_id menunjuk ke transaksi itu.
create or replace function catat_stok_opname(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_stok_fisik integer,
  p_alasan text default null,
  p_catatan text default null
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

  return v_opname;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Dipanggil dari frontend lewat lib/storage.ts (hook
--   useStokOpname), komponen StokOpnameForm/StokOpnameTable, dan
--   halaman app/(dashboard)/stok/[id]/opname.
-- - stok_sistem dan dibuat_oleh_nama diisi otomatis di dalam function
--   (security definer) -- bukan dikirim dari client, supaya snapshot
--   & jejak audit tidak bisa dipalsukan.
-- - Transaksi penyesuaian yang dibuat opname bisa dibatalkan lewat
--   fitur "Batalkan" di halaman Transaksi Stok / Riwayat Mutasi biasa
--   (function batalkan_transaksi_stok) kalau ternyata opname-nya
--   sendiri salah input -- membatalkannya akan mengembalikan stok ke
--   angka sebelum opname, TAPI baris stok_opname historisnya tetap
--   ada apa adanya (tidak ikut ditandai batal) supaya jejak "kapan
--   opname ini dilakukan" tidak hilang. Kalau perlu tahu status
--   transaksi terkait, cek transaksi_id di baris stok_opname lalu
--   lihat kolom `dibatalkan` di transaksi_stok.
