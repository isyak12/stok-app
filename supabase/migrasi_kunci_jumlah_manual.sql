-- ============================================================
-- Migrasi: kunci kolom `jumlah` di tabel `stok` supaya TIDAK BISA
-- diubah manual lewat form Ubah Barang (baik oleh staf MAUPUN
-- admin) -- jumlah HANYA boleh berubah lewat jalur resmi yang
-- sudah tercatat riwayatnya:
--   - catat_transaksi_stok()       (transaksi masuk/keluar)
--   - catat_transfer_stok()        (transfer dikirim)
--   - konfirmasi_terima_transfer() (transfer diterima)
--   - batalkan_transaksi_stok()    (pembatalan transaksi)
--   - batalkan_transfer_stok() / batalkan_transfer() (pembatalan transfer)
--   - catat_stok_opname()          (koreksi hasil hitung fisik)
--
-- Kenapa: jumlah stok adalah ANGKA HASIL, bukan data yang diinput
-- bebas -- kalau bisa ditimpa langsung dari form Ubah Barang, semua
-- jejak audit di atas (transaksi_stok, transfer_stok, stok_opname,
-- log_aktivitas_barang) jadi tidak bisa dipercaya sebagai sumber
-- kebenaran, karena stok bisa "meleset" dari riwayatnya sendiri
-- tanpa tercatat kenapa.
--
-- CARA KERJA: berbeda dari migrasi_kunci_stok_minimum.sql (yang
-- membedakan berdasarkan ROLE lewat saya_admin()), migrasi ini
-- membedakan berdasarkan JALUR PEMANGGILAN, karena aturannya "siapa
-- pun boleh, TAPI cuma lewat fungsi resmi" -- bukan soal role.
-- Triknya: setiap fungsi resmi di atas men-set flag transaksi
-- (set_config ... , is_local => true) SESAAT SEBELUM melakukan
-- `update stok set jumlah = ...`. Trigger di bawah cuma izinkan
-- perubahan jumlah kalau flag itu aktif. Flag ini otomatis hilang
-- begitu transaksi (RPC call) selesai -- jadi tidak "nyangkut" ke
-- query lain sesudahnya.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- semua file berikut sudah ada (migrasi ini menuliskan ULANG versi
-- TERBARU setiap fungsi di bawah, jadi urutan lamanya harus sudah
-- pernah dijalankan lebih dulu):
--   schema.sql, transaksi_stok.sql, migrasi_cabang.sql,
--   migrasi_transaksi_cabang.sql, transfer_stok.sql, mutasi_detail.sql,
--   pembatalan_transaksi.sql, pembatalan_transfer.sql,
--   migrasi_batal_transfer.sql, stok_opname.sql
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Trigger: tolak perubahan `jumlah` kecuali flag transaksi aktif
-- ------------------------------------------------------------
create or replace function cegah_ubah_manual_jumlah_stok()
returns trigger as $$
begin
  if new.jumlah is distinct from old.jumlah then
    if coalesce(current_setting('stokku.izinkan_ubah_jumlah', true), 'false') <> 'true' then
      raise exception
        'Jumlah stok tidak bisa diubah manual. Gunakan menu Transaksi Stok, Transfer, atau Stok Opname supaya perubahan tercatat di riwayat.'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cegah_ubah_manual_jumlah_stok on stok;
create trigger trg_cegah_ubah_manual_jumlah_stok
before update on stok
for each row execute function cegah_ubah_manual_jumlah_stok();

-- ------------------------------------------------------------
-- 2. catat_transaksi_stok() -- tambah flag sebelum update stok
--    (versi terbaru: sama seperti di mutasi_detail.sql, ditambah
--    1 baris perform set_config sebelum "update stok")
-- ------------------------------------------------------------
create or replace function catat_transaksi_stok(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_tipe text,
  p_jumlah integer,
  p_catatan text default null,
  p_pihak text default null,
  p_no_referensi text default null
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

  if p_cabang_id is null then
    raise exception 'Cabang harus dipilih';
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
    dibuat_oleh, dibuat_oleh_nama, pihak, no_referensi
  )
  values (
    p_produk_id, p_cabang_id, p_tipe, p_jumlah, p_catatan,
    auth.uid(), auth.email(), p_pihak, p_no_referensi
  )
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ------------------------------------------------------------
-- 3. catat_transfer_stok() -- versi terbaru dari mutasi_detail.sql
-- ------------------------------------------------------------
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

  select jumlah into v_stok_asal
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

  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
  update stok
  set jumlah = jumlah - p_jumlah
  where produk_id = p_produk_id
    and cabang_id = p_dari_cabang_id;

  insert into transfer_stok (
    produk_id, dari_cabang_id, ke_cabang_id, jumlah, catatan,
    status, dibuat_oleh, dibuat_oleh_nama
  )
  values (
    p_produk_id, p_dari_cabang_id, p_ke_cabang_id, p_jumlah, p_catatan,
    'terkirim', auth.uid(), auth.email()
  )
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ------------------------------------------------------------
-- 4. konfirmasi_terima_transfer() -- versi terbaru dari mutasi_detail.sql
-- ------------------------------------------------------------
create or replace function konfirmasi_terima_transfer(
  p_transfer_id uuid
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

  select stok_minimum, lokasi into v_stok_minimum_asal, v_lokasi_asal
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  perform 1
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.ke_cabang_id
  for update;

  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
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
      diterima_pada = now()
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ------------------------------------------------------------
-- 5. batalkan_transaksi_stok() -- versi terbaru dari pembatalan_transaksi.sql
-- ------------------------------------------------------------
create or replace function batalkan_transaksi_stok(
  p_transaksi_id uuid,
  p_alasan text default null
)
returns transaksi_stok
language plpgsql
security definer
as $$
declare
  v_transaksi transaksi_stok;
  v_stok_sekarang integer;
begin
  select * into v_transaksi
  from transaksi_stok
  where id = p_transaksi_id
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if v_transaksi.dibatalkan then
    raise exception 'Transaksi ini sudah dibatalkan sebelumnya';
  end if;

  select jumlah into v_stok_sekarang
  from stok
  where produk_id = v_transaksi.produk_id
    and cabang_id = v_transaksi.cabang_id
  for update;

  if not found then
    raise exception 'Data stok untuk produk ini di cabang terkait tidak ditemukan';
  end if;

  if v_transaksi.tipe = 'masuk' and v_stok_sekarang < v_transaksi.jumlah then
    raise exception
      'Tidak bisa membatalkan: stok saat ini (%) sudah lebih kecil dari jumlah transaksi ini (%), kemungkinan sebagian sudah terpakai transaksi/transfer lain setelahnya',
      v_stok_sekarang, v_transaksi.jumlah;
  end if;

  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
  update stok
  set jumlah = jumlah
    + case when v_transaksi.tipe = 'masuk' then -v_transaksi.jumlah else v_transaksi.jumlah end
  where produk_id = v_transaksi.produk_id
    and cabang_id = v_transaksi.cabang_id;

  update transaksi_stok
  set dibatalkan = true,
      dibatalkan_oleh = auth.uid(),
      dibatalkan_oleh_nama = auth.email(),
      dibatalkan_pada = now(),
      alasan_pembatalan = p_alasan
  where id = p_transaksi_id
  returning * into v_transaksi;

  return v_transaksi;
end;
$$;

-- ------------------------------------------------------------
-- 6. batalkan_transfer_stok() -- versi terbaru dari pembatalan_transfer.sql
-- ------------------------------------------------------------
create or replace function batalkan_transfer_stok(
  p_transfer_id uuid,
  p_alasan text default null
)
returns transfer_stok
language plpgsql
security definer
as $$
declare
  v_transfer transfer_stok;
begin
  select * into v_transfer
  from transfer_stok
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer tidak ditemukan';
  end if;

  if v_transfer.status = 'diterima' then
    raise exception
      'Transfer yang sudah dikonfirmasi diterima tidak bisa dibatalkan';
  end if;

  if v_transfer.status = 'dibatalkan' then
    raise exception 'Transfer ini sudah dibatalkan sebelumnya';
  end if;

  perform 1
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id
  for update;

  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
  update stok
  set jumlah = jumlah + v_transfer.jumlah
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  if not found then
    insert into stok (produk_id, cabang_id, jumlah, stok_minimum, lokasi)
    values (v_transfer.produk_id, v_transfer.dari_cabang_id, v_transfer.jumlah, 0, '');
  end if;

  update transfer_stok
  set status = 'dibatalkan',
      dibatalkan_oleh = auth.uid(),
      dibatalkan_oleh_nama = auth.email(),
      dibatalkan_pada = now(),
      alasan_pembatalan = p_alasan
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ------------------------------------------------------------
-- 7. batalkan_transfer() -- versi terbaru dari migrasi_batal_transfer.sql
--    (nama fungsi BEDA dari batalkan_transfer_stok() di atas -- kedua
--    fungsi ini sama-sama ada di database, jadi keduanya perlu
--    ditambahi flag. Kalau salah satu ternyata tidak lagi dipakai
--    kode aplikasi, tidak masalah tetap ditulis ulang di sini.)
-- ------------------------------------------------------------
create or replace function batalkan_transfer(
  p_transfer_id uuid,
  p_alasan text default null
)
returns transfer_stok
language plpgsql
security definer
as $$
declare
  v_transfer transfer_stok;
begin
  select * into v_transfer
  from transfer_stok
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer tidak ditemukan';
  end if;

  if v_transfer.status = 'diterima' then
    raise exception
      'Transfer yang sudah diterima cabang tujuan tidak bisa dibatalkan. Catat transfer balik (dari cabang tujuan ke cabang asal) kalau perlu dikembalikan.';
  end if;

  if v_transfer.status = 'dibatalkan' then
    raise exception 'Transfer ini sudah dibatalkan sebelumnya';
  end if;

  perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
  update stok
  set jumlah = jumlah + v_transfer.jumlah
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  if not found then
    raise notice
      'Baris stok cabang asal untuk produk % tidak ditemukan, stok tidak dikembalikan otomatis.',
      v_transfer.produk_id;
  end if;

  update transfer_stok
  set status = 'dibatalkan',
      dibatalkan_oleh = auth.uid(),
      dibatalkan_oleh_nama = auth.email(),
      dibatalkan_pada = now(),
      alasan_pembatalan = p_alasan
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ------------------------------------------------------------
-- 8. catat_stok_opname() -- versi terbaru dari stok_opname.sql
-- ------------------------------------------------------------
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

  return v_opname;
end;
$$;

-- ============================================================
-- Catatan
-- ============================================================
-- - Setelah migrasi ini, `perbarui()` di lib/storage.ts (dipanggil
--   dari form Ubah Barang) akan GAGAL kalau field jumlah yang
--   dikirim beda dari angka jumlah yang sekarang ada di database --
--   baik dipanggil oleh staf MAUPUN admin. Field "Jumlah Stok" di
--   StokForm.tsx perlu diubah jadi read-only (lihat pembaruan
--   StokForm.tsx terpisah) supaya form tidak pernah mengirim nilai
--   yang berbeda dari nilai saat ini.
-- - Perbaikan stok yang salah HARUS lewat menu Stok Opname (halaman
--   app/(dashboard)/stok/[id]/opname) -- ini justru jalur yang tepat
--   untuk "stok sistem ternyata tidak cocok dengan fisik", lengkap
--   dengan kewajiban isi alasan dan otomatis tercatat sebagai
--   transaksi penyesuaian.
-- - Kalau nanti ada fungsi BARU yang perlu mengubah `jumlah` di tabel
--   stok, WAJIB tambahkan
--     perform set_config('stokku.izinkan_ubah_jumlah', 'true', true);
--   tepat sebelum baris "update stok set jumlah = ..." di fungsi itu
--   -- kalau lupa, fungsi baru itu akan selalu gagal kena trigger ini.
