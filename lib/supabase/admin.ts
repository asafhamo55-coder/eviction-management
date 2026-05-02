import { createClient as createSb } from "@supabase/supabase-js";

export const EMS_SCHEMA = "eviction_management" as const;

/**
 * Server-only admin client. Uses the service-role key, so it BYPASSES RLS.
 * Use this ONLY from trusted server code where access is otherwise gated
 * (e.g. /portal/[token] routes that authenticate by opaque token).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for admin client");
  }
  return createSb(url, serviceKey, {
    db: { schema: EMS_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
