import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptionsWithName;
};

/**
 * Klien Supabase untuk dipakai di server component / server action.
 * Membaca & menulis sesi login lewat cookie Next.js.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Diabaikan: setAll dipanggil dari Server Component.
          // Sesi tetap ter-refresh selama middleware berjalan.
        }
      },
    },
  });
}
