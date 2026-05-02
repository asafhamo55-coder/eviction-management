import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AttorneysPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Attorney marketplace</CardTitle>
          <CardDescription>Find a licensed attorney for your jurisdiction — coming next milestone.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Hand-picked Atlanta-area attorneys; flat-fee and limited-scope options;
          payments via Stripe Connect.
        </CardContent>
      </Card>
    </main>
  );
}
