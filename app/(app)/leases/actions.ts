"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const leaseSchema = z.object({
  property_id: z.string().uuid(),
  tenancy_type: z.enum([
    "WRITTEN_LEASE", "ORAL_LEASE", "M2M", "WEEK_TO_WEEK",
    "AT_WILL", "SUBSIDIZED", "MOBILE_HOME_PARK",
  ]),
  start_date: z.string().min(1),
  end_date: z.string().optional().nullable(),
  rent_amount_dollars: z.coerce.number().min(0),
  rent_due_day: z.coerce.number().int().min(1).max(31),
  renter_ids: z.array(z.string().uuid()).min(1, "Pick at least one renter"),
});

export async function createLease(formData: FormData) {
  const renterIds = formData.getAll("renter_ids").map(String).filter(Boolean);

  const parsed = leaseSchema.parse({
    property_id: formData.get("property_id"),
    tenancy_type: formData.get("tenancy_type") || "WRITTEN_LEASE",
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || null,
    rent_amount_dollars: formData.get("rent_amount_dollars"),
    rent_due_day: formData.get("rent_due_day"),
    renter_ids: renterIds,
  });

  const supabase = await createClient();
  const orgId = await supabase.rpc("ensure_profile", { p_org_name: null });
  if (!orgId.data) throw new Error("Could not resolve organization");

  const { data: lease, error } = await supabase
    .from("leases")
    .insert({
      org_id: orgId.data,
      property_id: parsed.property_id,
      tenancy_type: parsed.tenancy_type,
      start_date: parsed.start_date,
      end_date: parsed.end_date,
      rent_amount_cents: Math.round(parsed.rent_amount_dollars * 100),
      rent_due_day: parsed.rent_due_day,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const links = parsed.renter_ids.map((rid) => ({ lease_id: lease.id, renter_id: rid }));
  const { error: linkErr } = await supabase.from("lease_renters").insert(links);
  if (linkErr) throw new Error(linkErr.message);

  revalidatePath(`/properties/${parsed.property_id}`);
  redirect(`/properties/${parsed.property_id}`);
}
