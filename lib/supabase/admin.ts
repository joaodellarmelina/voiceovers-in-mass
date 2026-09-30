import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Privileged client (secret key, bypasses RLS). Only for work with no user session:
 * the background Google Drive sync and reading Drive tokens. Every query MUST filter by user_id.
 * Never import this from client code; the key has no NEXT_PUBLIC_ prefix, so it never ships to the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY não configurada (necessária para a sincronização com o Drive).");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
