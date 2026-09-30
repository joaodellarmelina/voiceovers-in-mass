import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmailEdge } from "./lib/allowlist";

/**
 * Refreshes the Supabase session on every matched request and keeps signed-out users out of the app.
 * This is an optimistic check for redirects; route handlers still verify the user themselves.
 */
export async function proxy(request: NextRequest) {
  // Not configured yet: let requests through; requireUser() explains what to set.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        // Cache headers stop a CDN from serving one user's session cookie to another.
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const signedIn = !!claims?.sub && isAllowedEmailEdge(claims.email as string | undefined);

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isPublicApi = pathname.startsWith("/api/drive/callback");
  if (!signedIn && !isPublicApi && (pathname.startsWith("/dashboard") || isApi)) {
    if (isApi) return withSession(NextResponse.json({ error: "Faça login para continuar." }, { status: 401 }), supabaseResponse);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return withSession(NextResponse.redirect(url), supabaseResponse);
  }
  if (signedIn && pathname === "/login") {
    return withSession(NextResponse.redirect(new URL("/dashboard", request.url)), supabaseResponse);
  }

  // Must return the response setAll last built, or the refreshed cookies are lost.
  return supabaseResponse;
}

/** Any response other than supabaseResponse needs its cookies and cache headers copied over. */
function withSession(response: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}

export const config = {
  // Only routes that use Supabase: the app, its APIs and the auth pages. The landing page, blog
  // and static files never touch the session.
  matcher: ["/dashboard/:path*", "/api/:path*", "/login", "/auth/:path*"],
};
