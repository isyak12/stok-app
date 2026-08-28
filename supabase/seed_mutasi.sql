-- ============================================================
-- (Opsional) Contoh data mutasi_stok untuk testing
-- Jalankan setelah seed.sql, dan ganti produk_id dengan id asli
-- dari tabel produk di project kamu.
-- ============================================================

-- Lihat dulu id produk yang ada:
-- select id, nama, sku from produk;

-- Contoh: catat barang masuk 10 unit untuk salah satu produk
-- insert into mutasi_stok (produk_id, jenis, jumlah, keterangan, dibuat_oleh)
-- values ('ganti-dengan-produk-id', 'masuk', 10, 'Restock dari supplier', auth.uid());

-- Contoh: catat barang keluar 3 unit
-- insert into mutasi_stok (produk_id, jenis, jumlah, keterangan, dibuat_oleh)
-- values ('ganti-dengan-produk-id', 'keluar', 3, 'Penjualan ke pelanggan', auth.uid());
