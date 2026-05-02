"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const propertySchema = z.object({
  address_line1: z.string().min(1),
  address_line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().length(2),
  postal_code: z.string().min(3),
  county: z.string().optional().nullable(),
  property_type: z.enum(["SFR", "CONDO", "SMALL_MULTI", "LARGE_MULTI"]),
});

function jurisdictionFor(state: string, county: string | null | undefined) {
  if (!county) return `US-${state}`;
  return `US-${state}-${county.toUpperCase().replace(/\s+/g, "")}`;
}

export async function createProperty(formData: FormData) {
  const parsed = propertySchema.parse({
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2") || null,
    city: formData.get("city"),
    state: String(formData.get("state") || "").toUpperCase(),
    postal_code: formData.get("postal_code"),
    county: formData.get("county") || null,
    property_type: formData.get("property_type") || "SFR",
  });

  const supabase = await createClient();
  const orgId = await supabase.rpc("ensure_profile", { p_org_name: null });
  if (!orgId.data) throw new Error("Could not resolve organization");

  const { data, error } = await supabase
    .from("properties")
    .insert({
      ...parsed,
      org_id: orgId.data,
      jurisdiction_code: jurisdictionFor(parsed.state, parsed.county),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/properties");
  redirect(`/properties/${data.id}`);
}
