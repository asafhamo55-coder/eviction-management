import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewCasePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Start a new eviction</CardTitle>
          <CardDescription>Intake wizard — coming next milestone.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The wizard will collect property, lease, tenant, and grounds details, run
          jurisdictional checks, and generate the right notice for Fulton County.
        </CardContent>
      </Card>
    </main>
  );
}
