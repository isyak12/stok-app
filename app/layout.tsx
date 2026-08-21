import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stok - Skynet — Manajemen Stok Barang",
  description: "Aplikasi manajemen stok barang sederhana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="font-body">{children}</body>
    </html>
  );
}
