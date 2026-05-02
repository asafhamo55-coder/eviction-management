import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Action {
  label: string;
  href?: Route;
  hint?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function NextActions({ status, caseId, cureExpiresAt, hasFiling }: {
  status: string;
  caseId: string;
  cureExpiresAt: string | null;
  hasFiling: boolean;
}) {
  const actions: Action[] = [];

  switch (status) {
    case "DRAFT":
    case "INTAKE_COMPLETE":
      actions.push({ label: "Continue intake", href: `/cases/new?caseId=${caseId}` as Route });
      break;
    case "NOTICE_REQUIRED":
      actions.push({ label: "Open Demand for Possession PDF", href: `/cases/${caseId}/notice.pdf` as Route });
      actions.push({ label: "Mark notice served", hint: "Use the form below" });
      break;
    case "CURE_PERIOD":
      actions.push({ label: "View tenant portal link", href: `/cases/${caseId}` as Route, variant: "outline" });
      actions.push({ label: "Wait for cure or file complaint", hint: "If cure window expires" });
      break;
    case "CURE_EXPIRED":
    case "FILING_REQUIRED":
      actions.push({ label: hasFiling ? "Open complaint PDF" : "Draft complaint", href: `/cases/${caseId}/file` as Route });
      break;
    case "FILED":
      actions.push({ label: "Record summons + service", hint: "After clerk issues summons" });
      break;
    default:
      actions.push({ label: "No required action", hint: "We'll surface tasks as the case advances." });
  }

  const countdown = cureExpiresAt ? daysUntil(cureExpiresAt) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Next actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {countdown !== null ? (
          <div className={`rounded-md border p-3 text-sm ${countdown.urgent ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            <p className="font-medium">
              {countdown.expired
                ? `Cure window expired ${Math.abs(countdown.days)} day${Math.abs(countdown.days) === 1 ? "" : "s"} ago`
                : `Cure expires in ${countdown.days} day${countdown.days === 1 ? "" : "s"}`}
            </p>
            <p className="text-xs">{new Date(cureExpiresAt!).toLocaleDateString()}</p>
          </div>
        ) : null}

        {actions.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            {a.href ? (
              <Button asChild size="sm" variant={a.variant ?? "default"}>
                <Link href={a.href}>{a.label}</Link>
              </Button>
            ) : (
              <span className="text-sm font-medium">{a.label}</span>
            )}
            {a.hint ? <span className="text-xs text-muted-foreground">{a.hint}</span> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function daysUntil(iso: string): { days: number; urgent: boolean; expired: boolean } {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return { days, urgent: days <= 1, expired: days < 0 };
}
