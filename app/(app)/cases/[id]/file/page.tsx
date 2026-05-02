import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markFiled } from "../../actions";

export default async function FileComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id, status, computed, jurisdiction_code")
    .eq("id", id)
    .single();
  if (!caseRow) notFound();

  const { data: filings } = await supabase
    .from("filings")
    .select("id, court_name, filed_at, status, external_filing_id")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  const computed = (caseRow.computed ?? {}) as {
    rules?: { courtVenue?: { court_name: string; court_address?: string }; fee?: { fee_cents: number } };
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">File complaint</h1>
        <p className="text-sm text-muted-foreground">
          Court: {computed.rules?.courtVenue?.court_name ?? "—"}{" "}
          {computed.rules?.fee?.fee_cents ? `· filing fee $${(computed.rules.fee.fee_cents / 100).toFixed(2)}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispossessory Affidavit (draft)</CardTitle>
          <CardDescription>
            Generated from the seeded GA complaint template. Review carefully before filing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={`/cases/${id}/complaint.pdf`} target="_blank" rel="noreferrer">View / download PDF</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to file</CardTitle>
          <CardDescription>
            E-filing integration is on the roadmap; for now file in person or by mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Print the PDF and sign it before a notary.</li>
            <li>Take it to {computed.rules?.courtVenue?.court_name ?? "your county court"} at {computed.rules?.courtVenue?.court_address ?? "the courthouse"}.</li>
            <li>Pay the filing fee ({computed.rules?.fee?.fee_cents ? `$${(computed.rules.fee.fee_cents / 100).toFixed(2)}` : "—"}).</li>
            <li>The clerk will stamp a conformed copy. Upload it below to record the filing.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record filing</CardTitle>
          <CardDescription>Once stamped by the clerk, mark this case filed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={markFiled} className="space-y-3">
            <input type="hidden" name="case_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="filed_at">Filed on</Label>
                <Input id="filed_at" name="filed_at" type="date" required defaultValue={today} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="external_filing_id">Court case # (optional)</Label>
                <Input id="external_filing_id" name="external_filing_id" />
              </div>
            </div>
            <Button type="submit">Mark filed</Button>
          </form>
        </CardContent>
      </Card>

      {filings && filings.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Recorded filings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filings.map((f) => (
              <div key={f.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{f.court_name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.filed_at ? `Filed ${new Date(f.filed_at).toLocaleDateString()}` : "Drafted"}
                  {f.external_filing_id ? ` · #${f.external_filing_id}` : ""} · {f.status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/cases/${id}`}>← Back to case</Link>
        </Button>
      </div>
    </div>
  );
}
