import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PropertiesPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>Property / lease / tenant management — coming next milestone.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Add a rental unit, tie a lease and tenants to it, and you&apos;ll be able to start a case from here.
        </CardContent>
      </Card>
    </main>
  );
}
