-- ============================================================
-- Migrasi: gabungkan alur "daftarkan produk ke cabang" dengan alur
-- "catat transaksi stok" jadi SATU LANGKAH, khusus untuk stok masuk.
--
-- Masalah sebelumnya:
--   Kalau produk belum pernah punya baris stok di suatu cabang,
--   catat_transaksi_stok() langsung raise exception "Data stok untuk
--   produk ini di cabang yang dipilih tidak ditemukan" -- staf harus
--   bolak-balik ke halaman "Ubah Barang" dulu untuk membuat baris
--   stok kosong di cabang itu (jumlah 0), baru bisa balik ke halaman
--   Transaksi dan mengisi form yang sama.
--
-- Perubahan di migrasi ini:
--   Kalau baris stok belum ada untuk kombinasi (produk, cabang) saat
--   fungsi dipanggil, baris itu OTOMATIS DIBUAT dulu (jumlah awal 0,
--   stok_minimum 0, lokasi kosong) tepat sebelum lanjut memproses
--   transaksi -- jadi form "Catat Stok Masuk/Keluar" langsung
--   berhasil tanpa langkah terpisah.
--
--   Untuk tipe "keluar": baris tetap dibuat otomatis, tapi validasi
--   stok cukup tetap jalan seperti biasa (stok awal 0 -> transaksi
--   keluar akan ditolak "Stok tidak cukup" kalau jumlah diminta > 0).
--   Ini sudah benar secara bisnis: tidak masuk akal mencatat barang
--   keluar dari cabang yang belum pernah kemasukan stok sama sekali.
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- supabase/migrasi_bukti_transaksi_stok.sql (migrasi ini menulis
-- ulang versi TERBARU catat_transaksi_stok, yaitu versi 9 parameter
-- dengan p_lampiran_urls & p_dibuat_pada -- signature tidak berubah,
-- jadi cukup `create or replace`, tidak perlu drop function).
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

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
    -- Belum ada baris stok untuk produk ini di cabang ini -- buat
    -- dulu baris barunya (jumlah awal 0) alih-alih menolak transaksi.
    -- ON CONFLICT jaga-jaga kalau ada race condition (dua transaksi
    -- pertama untuk cabang yang sama ditembak nyaris bersamaan).
    insert into stok (produk_id, cabang_id, jumlah, stok_minimum, lokasi)
    values (p_produk_id, p_cabang_id, 0, 0, '')
    on conflict (produk_id, cabang_id) do nothing;

    select jumlah into v_stok_sekarang
    from stok
    where produk_id = p_produk_id
      and cabang_id = p_cabang_id
    for update;
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
-- - Baris stok yang dibuat otomatis ini stok_minimum-nya 0 dan
--   lokasi-nya kosong -- kalau perlu diisi, tetap bisa diedit lewat
--   halaman "Ubah Barang" kapan saja SETELAH baris itu ada (field
--   tersebut tidak dikunci seperti kolom `jumlah`).
-- - Perubahan ini TIDAK mengubah lib/storage.ts maupun
--   TransaksiStokForm.tsx -- keduanya sudah memanggil RPC dengan
--   signature yang sama persis, jadi cukup jalankan file SQL ini di
--   Supabase, tidak perlu deploy ulang frontend untuk perbaikan ini
--   saja.
-- ============================================================
