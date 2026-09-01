-- ============================================================
-- Migrasi: wajibkan bukti foto pada stok opname KALAU ADA SELISIH
-- Jalankan file ini di Supabase Dashboard > SQL Editor SETELAH
-- migrasi_bukti_opname.sql (butuh function catat_stok_opname versi
-- 6 parameter dengan p_lampiran_urls sudah ada).
--
-- Latar belakang:
-- Transaksi manual (masuk/keluar) sudah wajib bukti foto (lihat
-- migrasi_bukti_transaksi_stok.sql + validasi di
-- TransaksiStokForm.tsx). Tapi transaksi penyesuaian yang lahir
-- dari opname (saat ada selisih) lewat RPC catat_stok_opname yang
-- terpisah, sehingga opname dengan selisih besar bisa lolos tanpa
-- foto sama sekali -- celah audit karena efeknya ke stok sama
-- persis dengan transaksi manual.
--
-- Perubahan:
-- Foto TETAP OPSIONAL kalau hasil hitung fisik cocok dengan stok
-- sistem (selisih = 0, tidak perlu direpotin foto). Foto jadi WAJIB
-- (minimal 1 URL) begitu ada selisih, supaya standar buktinya
-- konsisten dengan transaksi manual.
-- ============================================================

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

    -- Bukti foto wajib begitu ada selisih -- konsisten dengan aturan
    -- bukti wajib pada transaksi manual (masuk/keluar).
    if p_lampiran_urls is null or array_length(p_lampiran_urls, 1) is null
       or array_length(p_lampiran_urls, 1) = 0 then
      raise exception
        'Foto bukti wajib diunggah kalau ada selisih antara stok fisik dan stok sistem';
    end if;

    -- PENTING (bugfix): sama seperti di catat_transfer_stok
    -- (migrasi_bukti_pengiriman.sql), baris `perform set_config` ini
    -- SEBELUMNYA tidak ada di file ini -- akibatnya, begitu trigger
    -- dari migrasi_kunci_jumlah_manual.sql aktif, mencatat stok
    -- opname yang ada selisihnya SELALU gagal dengan error "Jumlah
    -- stok tidak bisa diubah manual...", padahal dipanggil dari
    -- jalur resmi catat_stok_opname().
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
-- - Signature function TIDAK berubah (masih 6 parameter, sama
--   dengan migrasi_bukti_opname.sql), jadi tidak perlu drop
--   function dan tidak perlu ubah kode pemanggil di lib/storage.ts.
-- - Opname LAMA yang sudah tersimpan sebelum migrasi ini (termasuk
--   yang punya selisih tapi tanpa foto) TIDAK terpengaruh -- validasi
--   ini hanya berlaku untuk pencatatan opname baru setelah migrasi
--   dijalankan.
-- - Validasi UI di StokOpnameForm.tsx sudah mewajibkan foto saat ada
--   selisih (untuk UX yang cepat, sebelum request ke server), tapi
--   validasi di RPC ini WAJIB tetap ada sebagai lapisan pertahanan
--   sisi server -- validasi client bisa saja dilewati.
