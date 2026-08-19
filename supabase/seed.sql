-- ============================================================
-- Data contoh (opsional) — jalankan setelah schema.sql
-- Berguna untuk langsung melihat isi Dasbor & Daftar Stok.
-- ============================================================

with produk_baru as (
  insert into produk (sku, nama, kategori, satuan, harga_beli, harga_jual)
  values
    ('ELK-0012', 'Kabel HDMI 2m', 'Elektronik', 'pcs', 18000, 29000),
    ('ATK-0087', 'Kertas HVS A4 80gr', 'Alat Tulis', 'rim', 42000, 55000),
    ('RTG-0034', 'Beras Premium 5kg', 'Sembako', 'karung', 62000, 71000),
    ('ELK-0045', 'Lampu LED 12W', 'Elektronik', 'pcs', 14000, 23000),
    ('PRT-0021', 'Sabun Cuci Piring 800ml', 'Perawatan Rumah', 'botol', 9500, 14000)
  returning id, sku
)
insert into stok (produk_id, jumlah, stok_minimum, lokasi)
select
  p.id,
  case p.sku
    when 'ELK-0012' then 42
    when 'ATK-0087' then 8
    when 'RTG-0034' then 120
    when 'ELK-0045' then 5
    when 'PRT-0021' then 60
  end,
  case p.sku
    when 'ELK-0012' then 15
    when 'ATK-0087' then 10
    when 'RTG-0034' then 30
    when 'ELK-0045' then 20
    when 'PRT-0021' then 25
  end,
  case p.sku
    when 'ELK-0012' then 'Rak A1'
    when 'ATK-0087' then 'Rak B3'
    when 'RTG-0034' then 'Gudang Belakang'
    when 'ELK-0045' then 'Rak A4'
    when 'PRT-0021' then 'Rak C2'
  end
from produk_baru p;
