import "server-only";
import { isAllowedEmailEdge as isAllowedEmail } from "./allowlist";
import { createClient } from "./supabase/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Faça login para continuar.");
  }
}

/**
 * The signed-in user plus a Supabase client acting as them (all queries go through RLS).
 * Uses getClaims(), which verifies the JWT signature; getSession() would trust an unverified cookie.
 * Also enforces the optional AUTH_ALLOWED_EMAILS allowlist.
 */
export async function requireUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env e reinicie o servidor.");
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !isAllowedEmail(claims.email as string | undefined)) throw new UnauthorizedError();
  return { supabase, userId: claims.sub, email: claims.email as string | undefined };
}
