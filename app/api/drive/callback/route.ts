import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { accountEmail, oauthClient, saveToken } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const returnTo = jar.get("drive_oauth_return")?.value ?? "/dashboard";
  const back = (status: string) => {
    const url = new URL(returnTo, request.nextUrl.origin);
    url.searchParams.set("drive", status);
    jar.delete({ name: "drive_oauth_state", path: "/api/drive" });
    jar.delete({ name: "drive_oauth_return", path: "/api/drive" });
    return NextResponse.redirect(url);
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");
  if (!params.get("state") || params.get("state") !== jar.get("drive_oauth_state")?.value) return back("invalid");

  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.nextUrl.origin));
  }
  try {
    const { tokens } = await oauthClient(request.nextUrl.origin).getToken(params.get("code") ?? "");
    if (!tokens.refresh_token) return back("no-refresh-token");
    // Save first: looking up the account email needs a working client.
    await saveToken(userId, { refreshToken: tokens.refresh_token });
    await saveToken(userId, { refreshToken: tokens.refresh_token, email: await accountEmail(userId).catch(() => undefined) });
    return back("connected");
  } catch (err) {
    console.error(err);
    return back("error");
  }
}
