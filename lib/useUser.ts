"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { peranDariUser, Peran, adalahAdminAtauLebih } from "./role";

const supabase = createClient();

/**
 * Hook client untuk komponen yang perlu tahu peran user yang sedang
 * login (admin / staf), misalnya untuk menyembunyikan atau
 * menonaktifkan aksi yang tidak diizinkan di UI.
 *
 * CATATAN: ini HANYA untuk kenyamanan tampilan (menyembunyikan
 * tombol dsb). Pembatasan akses yang sesungguhnya WAJIB ditegakkan
 * di database lewat RLS policy & trigger (lihat
 * supabase/role-policies.sql) -- karena kode di sisi client selalu
 * bisa dilewati oleh pengguna yang cukup paham teknis.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    let aktif = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!aktif) return;
      setUser(data.user);
      setSiap(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setSiap(true);
      },
    );

    return () => {
      aktif = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const peran: Peran = peranDariUser(user);

  return {
    user,
    peran,
    siap,
    isAdmin: adalahAdminAtauLebih(peran),
    isSuperadmin: peran === "superadmin",
  };
}
