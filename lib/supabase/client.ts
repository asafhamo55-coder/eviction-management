import { createBrowserClient } from "@supabase/ssr";

export const EMS_SCHEMA = "eviction_management" as const;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: EMS_SCHEMA } },
  );
}
