import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLease } from "../actions";

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  if (!propertyId) redirect("/properties");

  const supabase = await createClient();
  const [{ data: property }, { data: renters }] = await Promise.all([
    supabase.from("properties").select("id, address_line1, city, state").eq("id", propertyId).single(),
    supabase.from("renters").select("id, full_name").order("full_name"),
  ]);
  if (!property) redirect("/properties");

  if (!renters || renters.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Add a renter first</CardTitle>
          <CardDescription>A lease needs at least one renter attached.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Property: {property.address_line1}, {property.city}, {property.state}
          </p>
          <Button asChild><Link href="/renters/new">Add a renter</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Add lease</CardTitle>
        <CardDescription>
          For {property.address_line1}, {property.city}, {property.state}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createLease} className="space-y-4">
          <input type="hidden" name="property_id" value={propertyId} />

          <div className="space-y-2">
            <Label>Renter(s)</Label>
            <div className="space-y-2 rounded-md border p-3">
              {renters.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="renter_ids" value={r.id} />
                  {r.full_name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenancy_type">Tenancy type</Label>
            <select
              id="tenancy_type"
              name="tenancy_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue="WRITTEN_LEASE"
            >
              <option value="WRITTEN_LEASE">Written lease</option>
              <option value="ORAL_LEASE">Oral lease</option>
              <option value="M2M">Month-to-month</option>
              <option value="WEEK_TO_WEEK">Week-to-week</option>
              <option value="AT_WILL">At-will</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date (blank = open)</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rent_amount_dollars">Monthly rent ($)</Label>
              <Input id="rent_amount_dollars" name="rent_amount_dollars" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rent_due_day">Rent due day</Label>
              <Input id="rent_due_day" name="rent_due_day" type="number" min="1" max="31" defaultValue={1} required />
            </div>
          </div>

          <Button type="submit" className="w-full">Save lease</Button>
        </form>
      </CardContent>
    </Card>
  );
}
