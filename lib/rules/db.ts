import { createClient } from "@/lib/supabase/server";
import { resolveRules } from "@/lib/rules/resolve";
import type { Grounds, Rule, TenancyType } from "@/lib/rules/types";

interface ResolveInput {
  state: string;        // e.g. "GA"
  county?: string;      // e.g. "Fulton"
  city?: string;
  grounds: Grounds;
  tenancyType: TenancyType;
}

export async function resolveRulesFromDb(input: ResolveInput) {
  const supabase = await createClient();

  const codes = ["US", `US-${input.state}`];
  if (input.county) codes.push(`US-${input.state}-${input.county.toUpperCase().replace(/\s+/g, "")}`);
  if (input.county && input.city) {
    codes.push(`US-${input.state}-${input.county.toUpperCase().replace(/\s+/g, "")}-${input.city.toUpperCase().replace(/\s+/g, "")}`);
  }

  const { data, error } = await supabase
    .from("jurisdiction_rules")
    .select("*")
    .in("jurisdiction_code", codes);
  if (error) throw new Error(error.message);

  return resolveRules((data ?? []) as Rule[], input);
}

export async function getNoticeTemplate(jurisdictionState: string, version = "GA_DEMAND_FOR_POSSESSION_v1") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_templates")
    .select("*")
    .eq("jurisdiction_code", `US-${jurisdictionState}`)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
