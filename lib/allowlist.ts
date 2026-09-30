/**
 * Optional allowlist. The ElevenLabs key is shared by everyone who signs in, so anyone able to create
 * an account could spend its credits: AUTH_ALLOWED_EMAILS="a@x.com,b@y.com" limits access.
 * No "server-only" import, so proxy.ts can use it too.
 */
export function isAllowedEmailEdge(email?: string) {
  const list = process.env.AUTH_ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !list?.length || (!!email && list.includes(email.toLowerCase()));
}
