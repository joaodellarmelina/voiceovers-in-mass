import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { DRIVE_SCOPES, oauthClient } from "@/lib/google-drive";

/** Starts Google sign-in. `state` in an httpOnly cookie guards the callback against CSRF. */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const origin = request.nextUrl.origin;
    const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/dashboard";
    const state = randomBytes(16).toString("hex");
    const jar = await cookies();
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/api/drive", maxAge: 600 };
    jar.set("drive_oauth_state", state, opts);
    // Only same-site paths, so the callback can't be used as an open redirect.
    jar.set("drive_oauth_return", returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard", opts);
    const url = oauthClient(origin).generateAuthUrl({
      access_type: "offline", // refresh token, so the connection survives restarts
      prompt: "consent",
      scope: DRIVE_SCOPES,
      include_granted_scopes: true,
      state,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    return errorResponse(err);
  }
}
