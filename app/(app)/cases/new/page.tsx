import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ leaseId?: string }>;
}) {
  const { leaseId } = await searchParams;
  const supabase = await createClient();

  // Always pull leases so the user can pick one if they didn't arrive with leaseId.
  const { data: leases } = await supabase
    .from("leases")
    .select(`
      id,
      tenancy_type,
      rent_amount_cents,
      start_date,
      property:properties ( id, address_line1, city, state, jurisdiction_code )
    `)
    .order("start_date", { ascending: false });

  if (!leases || leases.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>You need a lease first</CardTitle>
          <CardDescription>
            An eviction case is opened against a lease. Add a property and lease, then come back.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild><Link href="/properties/new">Add property</Link></Button>
          <Button asChild variant="outline"><Link href="/properties">View properties</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (leaseId) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Intake wizard</CardTitle>
          <CardDescription>
            Coming next milestone — grounds, jurisdictional checks, tenant protections, then we generate your notice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Lease selected: <code className="font-mono text-xs">{leaseId}</code></p>
          <p>The wizard will collect:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Grounds (Non-Payment / Holdover / Lease Violation / Other)</li>
            <li>Amount owed and ledger snapshot (for Non-Payment)</li>
            <li>SCRA / military-status check</li>
            <li>Protected-class flags (minor children, disability, DV, federally subsidized)</li>
            <li>Recommended notice + timeline preview</li>
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Start eviction</h1>
        <p className="text-sm text-muted-foreground">Pick the lease you want to file against.</p>
      </div>
      <div className="grid gap-3">
        {leases.map((l) => {
          const p = Array.isArray(l.property) ? l.property[0] : l.property;
          return (
            <Card key={l.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{p?.address_line1}</p>
                  <p className="text-xs text-muted-foreground">
                    {p?.city}, {p?.state} · {l.tenancy_type.replace(/_/g, " ")} · ${(l.rent_amount_cents / 100).toFixed(2)}/mo · {p?.jurisdiction_code}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/cases/new?leaseId=${l.id}`}>Select</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
