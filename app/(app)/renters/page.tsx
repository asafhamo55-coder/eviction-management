import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RentersPage() {
  const supabase = await createClient();
  await supabase.rpc("ensure_profile", { p_org_name: null });
  const { data: renters } = await supabase
    .from("renters")
    .select("id, full_name, email, phone")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Renters</h1>
          <p className="text-sm text-muted-foreground">People who rent from you. Used to populate notices and pleadings.</p>
        </div>
        <Button asChild><Link href="/renters/new">Add renter</Link></Button>
      </div>

      {renters && renters.length > 0 ? (
        <div className="grid gap-3">
          {renters.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <p className="font-medium">{r.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.email || "no email"} · {r.phone || "no phone"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No renters yet</CardTitle>
            <CardDescription>Add a renter so you can attach them to a lease.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/renters/new">Add renter</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
