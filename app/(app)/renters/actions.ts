"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const renterSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createRenter(formData: FormData) {
  const parsed = renterSchema.parse({
    full_name: formData.get("full_name"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    notes: formData.get("notes") || null,
  });

  const supabase = await createClient();
  const orgId = await supabase.rpc("ensure_profile", { p_org_name: null });
  if (!orgId.data) throw new Error("Could not resolve organization");

  const { error } = await supabase.from("renters").insert({
    ...parsed,
    email: parsed.email || null,
    org_id: orgId.data,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/renters");
  redirect("/renters");
}
