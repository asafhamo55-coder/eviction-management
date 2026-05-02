import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordTenantAcknowledgement, recordTenantPayment } from "./actions";

export default async function TenantPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: caseRow } = await admin
    .from("cases")
    .select(`
      id, status, grounds, jurisdiction_code, computed,
      lease:leases (
        rent_amount_cents,
        property:properties ( address_line1, city, state, postal_code )
      ),
      org:organizations ( name )
    `)
    .eq("tenant_portal_token", token)
    .single();
  if (!caseRow) notFound();

  const lease = Array.isArray(caseRow.lease) ? caseRow.lease[0] : caseRow.lease;
  const property = lease ? (Array.isArray(lease.property) ? lease.property[0] : lease.property) : null;
  const org = Array.isArray(caseRow.org) ? caseRow.org[0] : caseRow.org;
  const computed = (caseRow.computed ?? {}) as {
    amount_owed_cents?: number | null;
    rules?: { noticePeriod?: { duration_days: number } };
  };
  const owedDollars = ((computed.amount_owed_cents ?? 0) / 100).toFixed(2);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">From: {org?.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Notice regarding your tenancy</h1>
        <p className="text-sm text-muted-foreground">
          {property?.address_line1}, {property?.city}, {property?.state} {property?.postal_code}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this is</CardTitle>
          <CardDescription>Plain-language summary — the legal notice itself remains the authoritative document.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Your landlord has notified you about an issue with your tenancy
            ({caseRow.grounds.replace(/_/g, " ").toLowerCase()}).
            {computed.amount_owed_cents
              ? ` The amount they say is owed is $${owedDollars}.`
              : ""}
          </p>
          <p>You have options below. Every action is recorded and time-stamped for both sides.</p>
          <p className="text-xs text-muted-foreground">
            Need help? Find free local legal aid:{" "}
            <a className="underline" href="https://www.lawhelp.org/" target="_blank" rel="noreferrer">LawHelp.org</a>
          </p>
        </CardContent>
      </Card>

      {["TENANT_CURED", "TENANT_VACATED", "CLOSED_RESOLVED"].includes(caseRow.status) ? (
        <Card>
          <CardHeader>
            <CardTitle>This matter is closed</CardTitle>
            <CardDescription>Status: {caseRow.status.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pay the amount owed</CardTitle>
              <CardDescription>
                Recording your payment here notifies the landlord and may close the case if it covers the full amount.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={recordTenantPayment} className="space-y-3">
                <input type="hidden" name="token" value={token} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="amount_dollars">Amount ($)</Label>
                    <Input id="amount_dollars" name="amount_dollars" type="number" min="0.01" step="0.01" defaultValue={owedDollars} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reference">Reference (Zelle/Venmo/check #)</Label>
                    <Input id="reference" name="reference" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payer_email">Your email</Label>
                  <Input id="payer_email" name="payer_email" type="email" />
                </div>
                <Button type="submit" className="w-full">Record payment</Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Online card payments via Stripe will be available next. For now please pay outside the platform and record it here.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other options</CardTitle>
              <CardDescription>If you can&apos;t pay, choose what fits — your message is shared with the landlord.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["REQUEST_PLAN", "REQUEST_MEDIATION", "DISPUTE", "VACATE"] as const).map((intent) => (
                <form key={intent} action={recordTenantAcknowledgement} className="rounded-md border p-3 space-y-2">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="intent" value={intent} />
                  <p className="text-sm font-medium">{labelFor(intent)}</p>
                  <textarea
                    name="message"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Optional note to landlord"
                  />
                  <Button type="submit" size="sm" variant="outline">Send</Button>
                </form>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function labelFor(intent: "REQUEST_PLAN" | "REQUEST_MEDIATION" | "DISPUTE" | "VACATE"): string {
  switch (intent) {
    case "REQUEST_PLAN":      return "Propose a payment plan";
    case "REQUEST_MEDIATION": return "Request mediation";
    case "DISPUTE":           return "Dispute the notice";
    case "VACATE":            return "Acknowledge & plan to vacate";
  }
}
