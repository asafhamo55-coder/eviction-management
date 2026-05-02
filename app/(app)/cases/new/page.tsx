import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCase } from "../actions";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ leaseId?: string }>;
}) {
  const { leaseId } = await searchParams;
  const supabase = await createClient();
  await supabase.rpc("ensure_profile", { p_org_name: null });

  const { data: leases } = await supabase
    .from("leases")
    .select(`
      id, tenancy_type, rent_amount_cents, start_date,
      property:properties ( id, address_line1, city, state, jurisdiction_code )
    `)
    .order("start_date", { ascending: false });

  if (!leases || leases.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>You need a lease first</CardTitle>
          <CardDescription>An eviction case is opened against a lease.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild><Link href="/properties">Add property</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (!leaseId) {
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

  const selected = leases.find((l) => l.id === leaseId);
  if (!selected) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle>Lease not found</CardTitle></CardHeader>
        <CardContent>
          <Button asChild><Link href="/cases/new">Pick a different lease</Link></Button>
        </CardContent>
      </Card>
    );
  }
  const property = Array.isArray(selected.property) ? selected.property[0] : selected.property;
  const supportedJurisdiction = property?.jurisdiction_code === "US-GA-FULTON";

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Intake</CardTitle>
        <CardDescription>
          {property?.address_line1}, {property?.city}, {property?.state} · {property?.jurisdiction_code}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supportedJurisdiction ? (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            Heads up — only Fulton County, GA is fully supported at MVP. We&apos;ll still create the case
            and resolve any rules that match {property?.jurisdiction_code}, but the notice template
            may not be right for this jurisdiction.
          </div>
        ) : null}

        <form action={createCase} className="space-y-4">
          <input type="hidden" name="lease_id" value={leaseId} />

          <div className="space-y-2">
            <Label htmlFor="grounds">Grounds</Label>
            <select
              id="grounds"
              name="grounds"
              defaultValue="NON_PAYMENT"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="NON_PAYMENT">Non-payment of rent</option>
              <option value="LEASE_VIOLATION_CURABLE">Lease violation (curable)</option>
              <option value="LEASE_VIOLATION_NON_CURABLE">Lease violation (non-curable)</option>
              <option value="HOLDOVER">Holdover</option>
              <option value="NUISANCE_ILLEGAL">Nuisance / illegal use</option>
              <option value="NO_CAUSE">No-cause</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount_owed_dollars">Amount owed ($)</Label>
              <Input
                id="amount_owed_dollars"
                name="amount_owed_dollars"
                type="number"
                min="0"
                step="0.01"
                placeholder="1500.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="as_of_date">As of date</Label>
              <Input
                id="as_of_date"
                name="as_of_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">Tenant protections check</p>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="scra_confirmed" className="mt-1" />
              <span>I have confirmed the tenant is <span className="font-medium">not</span> active military (SCRA).</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="has_minor_children" className="mt-1" />
              <span>Minor children live in the unit</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="has_disability" className="mt-1" />
              <span>Tenant has a disability that affects the tenancy</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="is_dv_victim" className="mt-1" />
              <span>Tenant is a domestic violence survivor (VAWA)</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="federally_subsidized" className="mt-1" />
              <span>Property receives federal housing assistance (Sec 8 / LIHTC / CARES)</span>
            </label>
          </div>

          <Button type="submit" className="w-full">Open case &amp; generate notice</Button>
        </form>
      </CardContent>
    </Card>
  );
}
