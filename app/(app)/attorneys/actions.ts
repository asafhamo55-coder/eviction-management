"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const engageSchema = z.object({
  case_id: z.string().uuid(),
  attorney_id: z.string().uuid(),
  scope: z.enum([
    "Full representation",
    "Limited scope: draft & review complaint",
    "Limited scope: appear at first hearing",
    "Limited scope: review tenant answer",
    "Limited scope: negotiate settlement",
  ]),
  fee_arrangement_label: z.enum(["flat_uncontested", "limited_scope_appearance", "hourly"]),
});

export async function engageAttorney(formData: FormData) {
  const parsed = engageSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const orgId = await supabase.rpc("ensure_profile", { p_org_name: null });
  if (!orgId.data) throw new Error("Could not resolve organization");

  const { data: attorney, error: attyErr } = await supabase
    .from("attorneys")
    .select("id, full_name, rates")
    .eq("id", parsed.attorney_id)
    .single();
  if (attyErr || !attorney) throw new Error("Attorney not found");

  const rates = (attorney.rates ?? {}) as Record<string, number | undefined>;
  const fee_arrangement = {
    label: parsed.fee_arrangement_label,
    amount_dollars: rates[`${parsed.fee_arrangement_label}_dollars`] ?? null,
  };

  await supabase.from("engagements").insert({
    org_id: orgId.data,
    case_id: parsed.case_id,
    attorney_id: parsed.attorney_id,
    scope: parsed.scope,
    fee_arrangement,
    status: "pending",
  });

  await supabase.from("cases").update({
    status: "ATTORNEY_ENGAGED",
    attorney_id: parsed.attorney_id,
  }).eq("id", parsed.case_id);

  await supabase.from("case_events").insert({
    case_id: parsed.case_id,
    type: "ATTORNEY_ENGAGED",
    actor_type: "LANDLORD",
    payload: { attorney_id: parsed.attorney_id, scope: parsed.scope, fee_arrangement },
    next_state: "ATTORNEY_ENGAGED",
  });

  revalidatePath(`/cases/${parsed.case_id}`);
  redirect(`/cases/${parsed.case_id}`);
}
