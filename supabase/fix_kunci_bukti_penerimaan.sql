-- ============================================================
-- Perbaikan: konfirmasi_terima_transfer (versi dari
-- migrasi_bukti_penerimaan.sql) tidak men-set flag
-- 'stokku.izinkan_ubah_jumlah' sebelum UPDATE stok.jumlah, padahal
-- trigger dari migrasi_kunci_jumlah_manual.sql mewajibkan flag itu
-- aktif. Akibatnya "Tandai Diterima" bisa gagal dengan error
-- "Jumlah stok tidak bisa diubah manual...".
--
-- Aman dijalankan berkali-kali. Cukup jalankan file ini saja,
-- tidak perlu drop function dulu (signature 3 parameter sama
-- persis dengan yang sudah ada).
-- ============================================================

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

  select stok_minimum, lokasi into v_stok_minimum_asal, v_lokasi_asal
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.dari_cabang_id;

  perform 1
  from stok
  where produk_id = v_transfer.produk_id
    and cabang_id = v_transfer.ke_cabang_id
  for update;

  -- FIX: baris ini yang sebelumnya hilang.
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
      diterima_pada = now(),
      bukti_foto_url = p_bukti_foto_url,
      catatan_penerimaan = nullif(trim(p_catatan_penerimaan), '')
  where id = p_transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;
