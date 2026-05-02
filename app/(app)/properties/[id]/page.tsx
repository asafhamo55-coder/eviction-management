import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();
  if (!property) notFound();

  const { data: leases } = await supabase
    .from("leases")
    .select("id, start_date, end_date, rent_amount_cents, tenancy_type")
    .eq("property_id", id)
    .order("start_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{property.address_line1}</h1>
          <p className="text-sm text-muted-foreground">
            {property.city}, {property.state} {property.postal_code} · {property.jurisdiction_code}
          </p>
        </div>
        <Button asChild><Link href={`/leases/new?propertyId=${id}`}>Add lease</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leases</CardTitle>
          <CardDescription>Active and historical leases on this property.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {leases && leases.length > 0 ? (
            leases.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {l.tenancy_type.replace(/_/g, " ")} · ${(l.rent_amount_cents / 100).toFixed(2)}/mo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.start_date}{l.end_date ? ` → ${l.end_date}` : " (open-ended)"}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/cases/new?leaseId=${l.id}`}>Start eviction</Link>
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No leases yet. Add one to enable starting an eviction.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
