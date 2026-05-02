import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./signout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // First-visit bootstrap: idempotently create EMS org + profile.
  await supabase.rpc("ensure_profile", { p_org_name: null });

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold">Eviction Management</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard">Cases</Link>
            <Link href="/properties">Properties</Link>
            <Link href="/attorneys">Attorneys</Link>
            <span className="text-muted-foreground">{user.email}</span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
