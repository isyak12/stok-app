import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { emailKeUsername } from "@/lib/username";
import { peranDariUser } from "@/lib/role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Jaring pengaman kedua selain middleware
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar
        username={emailKeUsername(user.email ?? "")}
        peran={peranDariUser(user)}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
