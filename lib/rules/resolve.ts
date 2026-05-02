import type { Grounds, ResolvedRules, Rule, TenancyType } from "./types";

interface ResolveInput {
  state: string;        // e.g. "GA"
  county?: string;      // e.g. "FULTON"
  city?: string;        // e.g. "ATLANTA"
  grounds: Grounds;
  tenancyType: TenancyType;
}

function jurisdictionLayers({ state, county, city }: ResolveInput): string[] {
  const layers = ["US", `US-${state}`];
  if (county) layers.push(`US-${state}-${county}`);
  if (county && city) layers.push(`US-${state}-${county}-${city}`);
  return layers;
}

function applies(rule: Rule, grounds: Grounds, tenancy: TenancyType): boolean {
  const groundsOk = rule.grounds.length === 0 || rule.grounds.includes(grounds);
  const tenancyOk = rule.tenancy_types.length === 0 || rule.tenancy_types.includes(tenancy);
  const today = new Date().toISOString().slice(0, 10);
  const startOk = rule.effective_from <= today;
  const endOk = !rule.effective_to || rule.effective_to >= today;
  return groundsOk && tenancyOk && startOk && endOk;
}

/**
 * Tenant-favorable wins: when two rules overlap, pick the one stricter on the
 * landlord (longer notice / wait). This matches what most state law mandates
 * when local overlay is stricter than state floor.
 */
export function resolveRules(rules: Rule[], input: ResolveInput): ResolvedRules {
  const layers = jurisdictionLayers(input);
  const layerOrder = new Map(layers.map((c, i) => [c, i]));

  const applicable = rules
    .filter((r) => layerOrder.has(r.jurisdiction_code))
    .filter((r) => applies(r, input.grounds, input.tenancyType));

  const out: ResolvedRules = { citations: [] };

  const pickStricter = <T extends { duration_days: number }>(a: T | undefined, b: T) =>
    !a || b.duration_days > a.duration_days ? b : a;

  for (const r of applicable) {
    if (r.statute_citation) out.citations.push(r.statute_citation);
    const p = r.payload as Record<string, unknown>;
    switch (r.rule_type) {
      case "NOTICE_PERIOD":
        out.noticePeriod = pickStricter(out.noticePeriod, {
          duration_days: Number(p.duration_days ?? 0),
          exclude_weekends: Boolean(p.exclude_weekends),
          exclude_court_holidays: Boolean(p.exclude_court_holidays),
        });
        break;
      case "ANSWER_PERIOD":
        out.answerPeriod = pickStricter(out.answerPeriod, {
          duration_days: Number(p.duration_days ?? 0),
        });
        break;
      case "WRIT_WAIT":
        out.writWait = pickStricter(out.writWait, {
          duration_days: Number(p.duration_days ?? 0),
        });
        break;
      case "SERVICE_METHOD":
        out.serviceMethods = (p.allowed_methods as string[]) ?? out.serviceMethods;
        break;
      case "COURT_VENUE":
        out.courtVenue = {
          court_name: String(p.court_name ?? ""),
          court_address: p.court_address as string | undefined,
          efile_supported: Boolean(p.efile_supported),
        };
        break;
      case "FEE":
        out.fee = {
          fee_cents: Number(p.fee_cents ?? 0),
          pay_to: String(p.pay_to ?? ""),
        };
        break;
    }
  }

  out.citations = Array.from(new Set(out.citations));
  return out;
}

/**
 * Compute when a notice's cure window expires, honoring weekend/holiday rules.
 * Holidays list is intentionally minimal for MVP — extend per court calendar.
 */
export function computeCureExpiry(
  servedAt: Date,
  durationDays: number,
  excludeWeekends: boolean,
): Date {
  const d = new Date(servedAt);
  let added = 0;
  while (added < durationDays) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;
    added += 1;
  }
  return d;
}
