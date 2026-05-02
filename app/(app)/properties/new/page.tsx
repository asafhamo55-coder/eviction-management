import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createProperty } from "../actions";

export default function NewPropertyPage() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Add property</CardTitle>
        <CardDescription>Atlanta / Fulton County is fully supported at MVP.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createProperty} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Street address</Label>
            <Input id="address_line1" name="address_line1" required placeholder="123 Main St" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Unit / Apt (optional)</Label>
            <Input id="address_line2" name="address_line2" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required defaultValue="Atlanta" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" required maxLength={2} defaultValue="GA" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postal_code">ZIP</Label>
              <Input id="postal_code" name="postal_code" required defaultValue="30303" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="county">County</Label>
              <Input id="county" name="county" defaultValue="Fulton" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="property_type">Property type</Label>
            <select
              id="property_type"
              name="property_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue="SFR"
            >
              <option value="SFR">Single-family rental</option>
              <option value="CONDO">Condo</option>
              <option value="SMALL_MULTI">Small multifamily (2–10)</option>
              <option value="LARGE_MULTI">Large multifamily</option>
            </select>
          </div>
          <Button type="submit" className="w-full">Save property</Button>
        </form>
      </CardContent>
    </Card>
  );
}
