import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engageAttorney } from "./actions";

export default async function AttorneysPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const { caseId } = await searchParams;
  const supabase = await createClient();
  await supabase.rpc("ensure_profile", { p_org_name: null });

  const { data: attorneys } = await supabase
    .from("attorneys")
    .select("id, full_name, email, bar_id, jurisdictions, practice_areas, rates, rating")
    .eq("active", true)
    .order("rating", { ascending: false });

  let caseJurisdiction: string | null = null;
  if (caseId) {
    const { data: c } = await supabase
      .from("cases")
      .select("jurisdiction_code")
      .eq("id", caseId)
      .single();
    caseJurisdiction = c?.jurisdiction_code ?? null;
  }

  const filtered = attorneys ?? [];
  const eligible = caseJurisdiction
    ? filtered.filter((a) => a.jurisdictions?.includes(caseJurisdiction))
    : filtered;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attorney marketplace</h1>
        <p className="text-sm text-muted-foreground">
          {caseId
            ? `Showing attorneys licensed in ${caseJurisdiction}.`
            : "Hand-picked attorneys for landlord-tenant matters. Pick one, engage them, and we'll generate the engagement letter."}
        </p>
      </div>

      {eligible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No attorneys match this jurisdiction yet</CardTitle>
            <CardDescription>We&apos;re hand-recruiting attorneys market by market.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {eligible.map((a) => {
            const rates = (a.rates ?? {}) as Record<string, number | undefined>;
            return (
              <Card key={a.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{a.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Bar {a.bar_id} · {a.jurisdictions?.join(", ")} · ★ {a.rating?.toFixed?.(1) ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.practice_areas?.join(", ")}</p>
                    </div>
                    <div className="text-right text-xs">
                      {rates.flat_uncontested_dollars ? (
                        <p>Flat uncontested: <span className="font-medium">${rates.flat_uncontested_dollars}</span></p>
                      ) : null}
                      {rates.limited_scope_appearance_dollars ? (
                        <p>Limited-scope hearing: <span className="font-medium">${rates.limited_scope_appearance_dollars}</span></p>
                      ) : null}
                      {rates.hourly_dollars ? (
                        <p>Hourly: <span className="font-medium">${rates.hourly_dollars}/hr</span></p>
                      ) : null}
                    </div>
                  </div>

                  {caseId ? (
                    <form action={engageAttorney} className="flex flex-wrap items-end gap-2 border-t pt-3">
                      <input type="hidden" name="case_id" value={caseId} />
                      <input type="hidden" name="attorney_id" value={a.id} />
                      <select
                        name="scope"
                        defaultValue="Limited scope: appear at first hearing"
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option>Full representation</option>
                        <option>Limited scope: draft &amp; review complaint</option>
                        <option>Limited scope: appear at first hearing</option>
                        <option>Limited scope: review tenant answer</option>
                        <option>Limited scope: negotiate settlement</option>
                      </select>
                      <select
                        name="fee_arrangement_label"
                        defaultValue="flat_uncontested"
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="flat_uncontested">Flat uncontested</option>
                        <option value="limited_scope_appearance">Limited-scope hearing</option>
                        <option value="hourly">Hourly</option>
                      </select>
                      <Button type="submit" size="sm">Engage</Button>
                    </form>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      To engage, open a case and click <Link className="underline" href="/dashboard">browse attorneys</Link> from there.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
