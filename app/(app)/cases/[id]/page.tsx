import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markNoticeServed } from "../actions";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("cases")
    .select(`
      id, status, grounds, jurisdiction_code, opened_at, flags, computed,
      lease:leases (
        rent_amount_cents, tenancy_type,
        property:properties ( address_line1, city, state, postal_code, jurisdiction_code )
      )
    `)
    .eq("id", id)
    .single();
  if (!caseRow) notFound();

  const { data: notices } = await supabase
    .from("notices")
    .select("id, type, served_at, service_method, computed_expires_at, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  const { data: events } = await supabase
    .from("case_events")
    .select("id, type, actor_type, payload, prev_state, next_state, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  const lease = Array.isArray(caseRow.lease) ? caseRow.lease[0] : caseRow.lease;
  const property = lease ? (Array.isArray(lease.property) ? lease.property[0] : lease.property) : null;
  const computed = (caseRow.computed ?? {}) as {
    amount_owed_cents?: number | null;
    rules?: { citations?: string[]; noticePeriod?: { duration_days: number }; courtVenue?: { court_name: string }; fee?: { fee_cents: number } };
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{caseRow.jurisdiction_code} · {caseRow.grounds.replace(/_/g, " ")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{property?.address_line1}</h1>
        <p className="text-sm text-muted-foreground">{property?.city}, {property?.state} {property?.postal_code}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{caseRow.status.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">Opened {new Date(caseRow.opened_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Jurisdiction</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{computed.rules?.courtVenue?.court_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              Filing fee: {computed.rules?.fee?.fee_cents ? `$${(computed.rules.fee.fee_cents / 100).toFixed(2)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Notice period: {computed.rules?.noticePeriod?.duration_days ?? "—"} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Owed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              ${(((computed.amount_owed_cents ?? 0) / 100)).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Snapshot at intake</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demand for Possession</CardTitle>
          <CardDescription>Generated from the seeded GA template.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={`/cases/${id}/notice.pdf`} target="_blank" rel="noreferrer">View / download PDF</a>
          </Button>
          {caseRow.status === "NOTICE_REQUIRED" ? (
            <form action={markNoticeServed} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="case_id" value={id} />
              <div className="space-y-1">
                <Label htmlFor="served_at" className="text-xs">Served on</Label>
                <Input id="served_at" name="served_at" type="date" defaultValue={today} required className="h-9 w-auto" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="service_method" className="text-xs">Method</Label>
                <select
                  id="service_method"
                  name="service_method"
                  defaultValue="PERSONAL"
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="PERSONAL">Personal</option>
                  <option value="POST_AND_MAIL">Post &amp; mail (tack)</option>
                  <option value="CERTIFIED_MAIL">Certified mail</option>
                </select>
              </div>
              <Button type="submit" size="sm" variant="outline">Mark notice served</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {notices && notices.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Notices</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {notices.map((n) => (
              <div key={n.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{n.type}</p>
                <p className="text-xs text-muted-foreground">
                  {n.served_at ? `Served ${new Date(n.served_at).toLocaleDateString()} · ${n.service_method}` : "Not yet served"}
                  {n.computed_expires_at ? ` · cure expires ${new Date(n.computed_expires_at).toLocaleDateString()}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {computed.rules?.citations && computed.rules.citations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Statutes consulted</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {computed.rules.citations.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events && events.length > 0 ? events.map((e) => (
            <div key={e.id} className="border-l-2 pl-3 text-sm">
              <p>
                <span className="font-medium">{e.type.replace(/_/g, " ")}</span>{" "}
                <span className="text-xs text-muted-foreground">· {e.actor_type}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
                {e.prev_state && e.next_state ? ` · ${e.prev_state} → ${e.next_state}` : ""}
              </p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No events yet.</p>}
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">← Back to cases</Link>
        </Button>
      </div>
    </div>
  );
}
