"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const recordPaymentSchema = z.object({
  token: z.string().uuid(),
  amount_dollars: z.coerce.number().positive(),
  reference: z.string().optional().nullable(),
  payer_email: z.string().email().optional().or(z.literal("")).nullable(),
});

export async function recordTenantPayment(formData: FormData) {
  const parsed = recordPaymentSchema.parse({
    token: formData.get("token"),
    amount_dollars: formData.get("amount_dollars"),
    reference: formData.get("reference") || null,
    payer_email: formData.get("payer_email") || null,
  });

  const admin = createAdminClient();
  const { data: caseRow, error: caseErr } = await admin
    .from("cases")
    .select("id, org_id, lease_id, status, computed")
    .eq("tenant_portal_token", parsed.token)
    .single();
  if (caseErr || !caseRow) throw new Error("Invalid portal link");

  const cents = Math.round(parsed.amount_dollars * 100);

  await admin.from("payments").insert({
    org_id: caseRow.org_id,
    case_id: caseRow.id,
    amount_cents: cents,
    type: "TENANT_CURE_PAYMENT",
    source: parsed.reference ? `manual:${parsed.reference}` : "manual",
    status: "recorded",
  });
  await admin.from("ledger_entries").insert({
    org_id: caseRow.org_id,
    lease_id: caseRow.lease_id,
    case_id: caseRow.id,
    credit_cents: cents,
    memo: `Tenant payment via portal${parsed.payer_email ? ` (${parsed.payer_email})` : ""}`,
  });

  // If full balance covered, transition to TENANT_CURED.
  const computed = (caseRow.computed ?? {}) as { amount_owed_cents?: number };
  const owed = computed.amount_owed_cents ?? 0;
  if (owed > 0 && cents >= owed && ["NOTICE_SERVED", "CURE_PERIOD"].includes(caseRow.status)) {
    await admin.from("cases").update({ status: "TENANT_CURED" }).eq("id", caseRow.id);
    await admin.from("case_events").insert({
      case_id: caseRow.id,
      type: "TENANT_CURED",
      actor_type: "TENANT",
      payload: { amount_cents: cents, source: "portal" },
      prev_state: caseRow.status,
      next_state: "TENANT_CURED",
    });
  } else {
    await admin.from("case_events").insert({
      case_id: caseRow.id,
      type: "PAYMENT_RECEIVED",
      actor_type: "TENANT",
      payload: { amount_cents: cents, source: "portal" },
    });
  }

  revalidatePath(`/portal/${parsed.token}`);
}

const acknowledgeSchema = z.object({
  token: z.string().uuid(),
  intent: z.enum(["VACATE", "DISPUTE", "REQUEST_PLAN", "REQUEST_MEDIATION"]),
  message: z.string().optional().nullable(),
});

export async function recordTenantAcknowledgement(formData: FormData) {
  const parsed = acknowledgeSchema.parse(Object.fromEntries(formData));

  const admin = createAdminClient();
  const { data: caseRow, error } = await admin
    .from("cases")
    .select("id, org_id")
    .eq("tenant_portal_token", parsed.token)
    .single();
  if (error || !caseRow) throw new Error("Invalid portal link");

  await admin.from("communications").insert({
    org_id: caseRow.org_id,
    case_id: caseRow.id,
    channel: "PORTAL",
    direction: "INBOUND",
    subject: `Tenant: ${parsed.intent}`,
    body: parsed.message ?? null,
  });
  await admin.from("case_events").insert({
    case_id: caseRow.id,
    type: `TENANT_${parsed.intent}`,
    actor_type: "TENANT",
    payload: { message: parsed.message ?? null },
  });

  revalidatePath(`/portal/${parsed.token}`);
}
