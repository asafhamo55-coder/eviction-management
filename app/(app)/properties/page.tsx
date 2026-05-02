import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PropertiesPage() {
  const supabase = await createClient();
  await supabase.rpc("ensure_profile", { p_org_name: null });
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address_line1, city, state, postal_code, jurisdiction_code, property_type")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground">Rental units in your portfolio.</p>
        </div>
        <Button asChild><Link href="/properties/new">Add property</Link></Button>
      </div>

      {properties && properties.length > 0 ? (
        <div className="grid gap-3">
          {properties.map((p) => (
            <Link key={p.id} href={`/properties/${p.id}`}>
              <Card className="transition hover:bg-accent">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{p.address_line1}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.city}, {p.state} {p.postal_code} · {p.property_type} · {p.jurisdiction_code}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No properties yet</CardTitle>
            <CardDescription>Add a rental unit to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/properties/new">Add property</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
