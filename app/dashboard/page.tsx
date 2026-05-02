import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, status, grounds, jurisdiction_code, opened_at")
    .order("opened_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">All eviction cases for your organization.</p>
        </div>
        <Button asChild><Link href="/cases/new">Start eviction</Link></Button>
      </div>

      {cases && cases.length > 0 ? (
        <div className="grid gap-3">
          {cases.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.grounds.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.jurisdiction_code} · opened {new Date(c.opened_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-md border px-2 py-1 text-xs">{c.status}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No cases yet</CardTitle>
            <CardDescription>Start your first eviction to populate this dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/cases/new">Start eviction</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
