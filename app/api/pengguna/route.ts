import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { peranDariUser, Peran } from "@/lib/role";
import { usernameKeEmail, emailKeUsername, usernameValid } from "@/lib/username";

// Peran yang boleh diberikan lewat API ini. "superadmin" SENGAJA tidak
// diizinkan di sini -- lihat catatan di supabase/migrasi_superadmin.sql:
// mengangkat superadmin cuma bisa manual lewat SQL Editor, supaya
// superadmin tidak bisa membuat superadmin lain lewat aplikasi.
const PERAN_BOLEH_DIBUAT: Peran[] = ["admin", "staf"];

/**
 * Pastikan request datang dari user yang sudah login DAN berperan
 * superadmin. Dipanggil di awal setiap handler di file ini.
 *
 * PENTING: ini pengecekan wajib di sisi server -- jangan pernah
 * mengandalkan hanya UI (tombol disembunyikan) untuk membatasi akses
 * ke operasi bikin/ubah/hapus akun, karena route ini memakai service
 * role key yang bypass RLS sepenuhnya.
 */
async function pastikanSuperadmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || peranDariUser(user) !== "superadmin") {
    return null;
  }
  return user;
}

function tanggapanTanpaIzin() {
  return NextResponse.json(
    { error: "Khusus superadmin yang boleh mengelola pengguna." },
    { status: 403 },
  );
}

/**
 * GET /api/pengguna
 * Daftar semua akun pengguna beserta perannya. Dipakai halaman
 * app/(dashboard)/pengguna.
 */
export async function GET() {
  const superadmin = await pastikanSuperadmin();
  if (!superadmin) return tanggapanTanpaIzin();

  const admin = createAdminClient();

  // listUsers dipaginasi Supabase (default 50/halaman) -- diambil
  // beberapa halaman berturut-turut supaya semua akun ikut tampil,
  // bukan cuma 50 pertama. Cukup untuk skala tim kecil/menengah.
  const semuaUser: {
    id: string;
    username: string;
    peran: Peran;
    dibuatPada: string;
  }[] = [];
  let halaman = 1;
  const perHalaman = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: halaman,
      perPage: perHalaman,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const u of data.users) {
      semuaUser.push({
        id: u.id,
        username: emailKeUsername(u.email ?? ""),
        peran: peranDariUser(u),
        dibuatPada: u.created_at,
      });
    }
    if (data.users.length < perHalaman) break;
    halaman += 1;
  }

  semuaUser.sort((a, b) => a.username.localeCompare(b.username));

  return NextResponse.json({ data: semuaUser });
}

/**
 * POST /api/pengguna
 * Body: { username: string, password: string, peran: "admin" | "staf" }
 * Membuat akun baru. Username diubah jadi email internal
 * (lihat lib/username.ts) karena Supabase Auth berbasis email.
 */
export async function POST(request: NextRequest) {
  const superadmin = await pastikanSuperadmin();
  if (!superadmin) return tanggapanTanpaIzin();

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const peran = body?.peran;

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Username minimal 3 karakter." },
      { status: 400 },
    );
  }
  // Bugfix: tanpa pengecekan ini, username seperti "staf@gudang"
  // lolos ke usernameKeEmail() dan diam-diam kehilangan karakter "@"
  // -- akun jadi dibuat dengan username yang beda dari yang diketik
  // admin, tanpa pemberitahuan apa pun.
  if (!usernameValid(username)) {
    return NextResponse.json(
      {
        error:
          "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip (tanpa spasi/simbol lain).",
      },
      { status: 400 },
    );
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password minimal 6 karakter." },
      { status: 400 },
    );
  }
  if (!PERAN_BOLEH_DIBUAT.includes(peran)) {
    return NextResponse.json(
      { error: "Peran harus 'admin' atau 'staf'." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameKeEmail(username),
    password,
    email_confirm: true, // auto-confirm: tidak perlu email verifikasi sungguhan
    app_metadata: { peran },
  });

  if (error) {
    const pesan = error.message.includes("already been registered")
      ? "Username sudah dipakai."
      : error.message;
    return NextResponse.json({ error: pesan }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      id: data.user.id,
      username: emailKeUsername(data.user.email ?? ""),
      peran: peran as Peran,
      dibuatPada: data.user.created_at,
    },
  });
}

/**
 * PATCH /api/pengguna
 * Body: { id: string, peran: "admin" | "staf" }
 * Mengubah peran akun yang sudah ada. Tidak bisa dipakai untuk
 * mengangkat/menurunkan superadmin (lihat PERAN_BOLEH_DIBUAT).
 */
export async function PATCH(request: NextRequest) {
  const superadmin = await pastikanSuperadmin();
  if (!superadmin) return tanggapanTanpaIzin();

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const peran = body?.peran;

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });
  }
  if (!PERAN_BOLEH_DIBUAT.includes(peran)) {
    return NextResponse.json(
      { error: "Peran harus 'admin' atau 'staf'." },
      { status: 400 },
    );
  }
  if (id === superadmin.id) {
    return NextResponse.json(
      { error: "Tidak bisa mengubah peran akun sendiri." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Jangan izinkan menurunkan superadmin LAIN lewat API ini.
  const { data: target, error: errAmbil } =
    await admin.auth.admin.getUserById(id);
  if (errAmbil || !target.user) {
    return NextResponse.json(
      { error: "Pengguna tidak ditemukan." },
      { status: 404 },
    );
  }
  if (peranDariUser(target.user) === "superadmin") {
    return NextResponse.json(
      { error: "Peran superadmin tidak bisa diubah lewat halaman ini." },
      { status: 400 },
    );
  }

  // Gabungkan (merge) dengan app_metadata yang sudah ada, bukan
  // menimpa seluruh objeknya -- Admin API menimpa app_metadata utuh
  // per field yang dikirim di sini, jadi kalau nanti ada field lain
  // selain "peran" di app_metadata, field itu tidak boleh ikut hilang
  // hanya karena mengubah peran.
  const { data, error } = await admin.auth.admin.updateUserById(id, {
    app_metadata: { ...target.user.app_metadata, peran },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      id: data.user.id,
      username: emailKeUsername(data.user.email ?? ""),
      peran: peran as Peran,
      dibuatPada: data.user.created_at,
    },
  });
}

/**
 * PUT /api/pengguna
 * Body: { id: string, password: string }
 * Reset password akun yang sudah ada (mis. staf lupa password).
 * Sama seperti PATCH (ubah peran): tidak bisa dipakai untuk akun
 * sendiri (pakai halaman "Ubah Password" untuk itu) atau untuk
 * akun superadmin lain -- supaya satu superadmin tidak bisa
 * mengambil alih akun superadmin lain lewat reset password diam-diam.
 */
export async function PUT(request: NextRequest) {
  const superadmin = await pastikanSuperadmin();
  if (!superadmin) return tanggapanTanpaIzin();

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password minimal 6 karakter." },
      { status: 400 },
    );
  }
  if (id === superadmin.id) {
    return NextResponse.json(
      {
        error:
          "Tidak bisa reset password akun sendiri lewat sini -- gunakan halaman Ubah Password.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Jangan izinkan reset password superadmin LAIN lewat API ini,
  // konsisten dengan pembatasan yang sama di PATCH (ubah peran) dan
  // DELETE (hapus akun) di bawah.
  const { data: target, error: errAmbil } =
    await admin.auth.admin.getUserById(id);
  if (errAmbil || !target.user) {
    return NextResponse.json(
      { error: "Pengguna tidak ditemukan." },
      { status: 404 },
    );
  }
  if (peranDariUser(target.user) === "superadmin") {
    return NextResponse.json(
      { error: "Password superadmin tidak bisa direset lewat halaman ini." },
      { status: 400 },
    );
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: { id } });
}

/**
 * DELETE /api/pengguna
 * Body: { id: string }
 * Menghapus akun. Superadmin tidak bisa menghapus dirinya sendiri
 * atau superadmin lain lewat halaman ini.
 */
export async function DELETE(request: NextRequest) {
  const superadmin = await pastikanSuperadmin();
  if (!superadmin) return tanggapanTanpaIzin();

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });
  }
  if (id === superadmin.id) {
    return NextResponse.json(
      { error: "Tidak bisa menghapus akun sendiri." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: target, error: errAmbil } =
    await admin.auth.admin.getUserById(id);
  if (errAmbil || !target.user) {
    return NextResponse.json(
      { error: "Pengguna tidak ditemukan." },
      { status: 404 },
    );
  }
  if (peranDariUser(target.user) === "superadmin") {
    return NextResponse.json(
      { error: "Akun superadmin tidak bisa dihapus lewat halaman ini." },
      { status: 400 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: { id } });
}
