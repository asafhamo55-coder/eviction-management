"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveRulesFromDb } from "@/lib/rules/db";
import { computeCureExpiry } from "@/lib/rules/resolve";

const intakeSchema = z.object({
  lease_id: z.string().uuid(),
  grounds: z.enum([
    "NON_PAYMENT", "LEASE_VIOLATION_CURABLE", "LEASE_VIOLATION_NON_CURABLE",
    "HOLDOVER", "NUISANCE_ILLEGAL", "NO_CAUSE",
  ]),
  amount_owed_dollars: z.coerce.number().min(0).optional().nullable(),
  as_of_date: z.string().optional().nullable(),
  scra_confirmed: z.literal("on").optional().nullable(),
  has_minor_children: z.literal("on").optional().nullable(),
  has_disability: z.literal("on").optional().nullable(),
  is_dv_victim: z.literal("on").optional().nullable(),
  federally_subsidized: z.literal("on").optional().nullable(),
});

export async function createCase(formData: FormData) {
  const parsed = intakeSchema.parse(Object.fromEntries(formData));

  const supabase = await createClient();
  const orgId = await supabase.rpc("ensure_profile", { p_org_name: null });
  if (!orgId.data) throw new Error("Could not resolve organization");

  // Pull lease + property to get jurisdiction.
  const { data: lease, error: leaseErr } = await supabase
    .from("leases")
    .select(`
      id, tenancy_type,
      property:properties ( id, state, county, city, jurisdiction_code )
    `)
    .eq("id", parsed.lease_id)
    .single();
  if (leaseErr || !lease) throw new Error(leaseErr?.message ?? "Lease not found");
  const property = Array.isArray(lease.property) ? lease.property[0] : lease.property;
  if (!property) throw new Error("Property not found");

  // Resolve flags.
  const flags: string[] = [];
  if (parsed.federally_subsidized) flags.push("FEDERALLY_SUBSIDIZED");
  if (parsed.is_dv_victim) flags.push("DV_VICTIM");
  if (!parsed.scra_confirmed) flags.push("SCRA_UNCONFIRMED");

  // Resolve jurisdictional rules.
  const rules = await resolveRulesFromDb({
    state: property.state,
    county: property.county ?? undefined,
    city: property.city,
    grounds: parsed.grounds,
    tenancyType: lease.tenancy_type as
      "WRITTEN_LEASE" | "ORAL_LEASE" | "M2M" | "WEEK_TO_WEEK" | "AT_WILL" | "SUBSIDIZED" | "MOBILE_HOME_PARK",
  });

  // Snapshot ledger entry for non-payment cases.
  if (parsed.grounds === "NON_PAYMENT" && parsed.amount_owed_dollars && parsed.amount_owed_dollars > 0) {
    await supabase.from("ledger_entries").insert({
      org_id: orgId.data,
      lease_id: parsed.lease_id,
      debit_cents: Math.round(parsed.amount_owed_dollars * 100),
      memo: "Snapshot at case open",
    });
  }

  // Create case in NOTICE_REQUIRED.
  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .insert({
      org_id: orgId.data,
      lease_id: parsed.lease_id,
      grounds: parsed.grounds,
      jurisdiction_code: property.jurisdiction_code ?? `US-${property.state}`,
      status: "NOTICE_REQUIRED",
      flags,
      computed: {
        amount_owed_cents: parsed.amount_owed_dollars
          ? Math.round(parsed.amount_owed_dollars * 100)
          : null,
        as_of_date: parsed.as_of_date ?? null,
        rules,
      },
    })
    .select("id")
    .single();
  if (caseErr || !caseRow) throw new Error(caseErr?.message ?? "Could not create case");

  // Append intake event.
  await supabase.from("case_events").insert({
    case_id: caseRow.id,
    type: "INTAKE_COMPLETE",
    actor_type: "LANDLORD",
    payload: { grounds: parsed.grounds, flags, citations: rules.citations },
    prev_state: "DRAFT",
    next_state: "NOTICE_REQUIRED",
  });

  revalidatePath("/dashboard");
  redirect(`/cases/${caseRow.id}`);
}

const markFiledSchema = z.object({
  case_id: z.string().uuid(),
  filed_at: z.string().min(1),
  external_filing_id: z.string().optional().nullable(),
});

export async function markFiled(formData: FormData) {
  const parsed = markFiledSchema.parse({
    case_id: formData.get("case_id"),
    filed_at: formData.get("filed_at"),
    external_filing_id: formData.get("external_filing_id") || null,
  });

  const supabase = await createClient();

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, status, computed")
    .eq("id", parsed.case_id)
    .single();
  if (caseErr || !caseRow) throw new Error(caseErr?.message ?? "Case not found");

  const computed = (caseRow.computed ?? {}) as { rules?: { courtVenue?: { court_name?: string }; fee?: { fee_cents?: number } } };

  await supabase.from("filings").insert({
    case_id: parsed.case_id,
    court_name: computed.rules?.courtVenue?.court_name ?? null,
    filed_at: parsed.filed_at,
    external_filing_id: parsed.external_filing_id,
    status: "FILED",
    fee_cents: computed.rules?.fee?.fee_cents ?? null,
  });

  await supabase.from("cases").update({ status: "FILED" }).eq("id", parsed.case_id);

  await supabase.from("case_events").insert({
    case_id: parsed.case_id,
    type: "FILED",
    actor_type: "LANDLORD",
    payload: { filed_at: parsed.filed_at, external_filing_id: parsed.external_filing_id },
    prev_state: caseRow.status,
    next_state: "FILED",
  });

  revalidatePath(`/cases/${parsed.case_id}`);
  redirect(`/cases/${parsed.case_id}`);
}

const markServedSchema = z.object({
  case_id: z.string().uuid(),
  service_method: z.enum(["PERSONAL", "POST_AND_MAIL", "CERTIFIED_MAIL"]),
  served_at: z.string().min(1),
});

export async function markNoticeServed(formData: FormData) {
  const parsed = markServedSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, status, computed")
    .eq("id", parsed.case_id)
    .single();
  if (caseErr || !caseRow) throw new Error(caseErr?.message ?? "Case not found");

  const computed = (caseRow.computed ?? {}) as { rules?: { noticePeriod?: { duration_days: number; exclude_weekends: boolean } } };
  const np = computed.rules?.noticePeriod;
  const expiresAt = np
    ? computeCureExpiry(new Date(parsed.served_at), np.duration_days, np.exclude_weekends)
    : null;

  await supabase.from("notices").insert({
    case_id: parsed.case_id,
    type: "DEMAND_FOR_POSSESSION",
    served_at: parsed.served_at,
    service_method: parsed.service_method,
    computed_expires_at: expiresAt?.toISOString(),
  });

  await supabase
    .from("cases")
    .update({ status: "CURE_PERIOD" })
    .eq("id", parsed.case_id);

  await supabase.from("case_events").insert({
    case_id: parsed.case_id,
    type: "NOTICE_SERVED",
    actor_type: "LANDLORD",
    payload: {
      service_method: parsed.service_method,
      served_at: parsed.served_at,
      cure_expires_at: expiresAt?.toISOString(),
    },
    prev_state: "NOTICE_REQUIRED",
    next_state: "CURE_PERIOD",
  });

  revalidatePath(`/cases/${parsed.case_id}`);
}
