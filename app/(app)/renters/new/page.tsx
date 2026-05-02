import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createRenter } from "../actions";

export default function NewRenterPage() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Add renter</CardTitle>
        <CardDescription>Used on notices, complaints, and tenant-portal communication.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createRenter} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full legal name</Label>
            <Input id="full_name" name="full_name" required placeholder="Jane Doe" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" className="w-full">Save renter</Button>
        </form>
      </CardContent>
    </Card>
  );
}
