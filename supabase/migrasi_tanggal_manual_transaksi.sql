-- ============================================================
-- Migrasi: izinkan atur tanggal & waktu manual saat mencatat
-- transaksi stok masuk/keluar (mis. input transaksi minggu lalu
-- yang lupa dicatat), bukan selalu otomatis "sekarang".
--
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- `supabase/migrasi_kunci_jumlah_manual.sql` (file itu yang
-- menuliskan versi TERBARU function catat_transaksi_stok sebelum
-- migrasi ini, termasuk flag kunci kolom stok.jumlah -- migrasi ini
-- menulis ulang lagi di atasnya, jadi urutan itu wajib).
--
-- Aturan:
--   - Parameter baru p_dibuat_pada OPSIONAL (default null). Kalau
--     tidak diisi, perilaku lama tetap: pakai now() seperti biasa.
--   - Kalau diisi, tidak boleh di MASA DEPAN, dan paling jauh
--     MUNDUR 30 hari dari sekarang -- supaya riwayat tetap masuk
--     akal dan tidak dipakai untuk "menyusun ulang" data lama tanpa
--     batas.
--   - Semua peran (staf/admin/superadmin) boleh mengisi tanggal
--     manual ini -- tidak dibedakan berdasarkan role, sama seperti
--     field pihak/catatan/no_referensi yang sudah ada.
-- ============================================================

-- Signature TIDAK menghapus parameter lama, cuma menambah 1 di
-- akhir (semuanya sudah punya default sebelumnya) -- jadi cukup
-- `create or replace`, tidak perlu `drop function` dulu.
create or replace function catat_transaksi_stok(
  p_produk_id uuid,
  p_cabang_id uuid,
  p_tipe text,
  p_jumlah integer,
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

  -- Tanggal manual opsional: kosong -> pakai waktu sekarang seperti
  -- sebelumnya. Diisi -> divalidasi dulu (tidak boleh di masa depan,
  -- maksimal mundur 30 hari).
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

  return v_transaksi;
end;
$$;

-- ------------------------------------------------------------
-- Catatan
-- ------------------------------------------------------------
-- - Kolom `dibuat_pada` di tabel transaksi_stok sudah ada sejak
--   transaksi_stok.sql (default now()) -- migrasi ini tidak perlu
--   mengubah struktur tabel, hanya function-nya, karena defaultnya
--   cuma kepakai kalau function di-insert tanpa nilai eksplisit
--   (sekarang selalu diisi eksplisit lewat v_dibuat_pada).
-- - Riwayat & pengurutan (order by dibuat_pada desc) otomatis ikut
--   memakai tanggal manual ini, jadi transaksi yang "disusulkan"
--   untuk tanggal lampau akan muncul di urutan yang sesuai, bukan
--   di paling atas.
