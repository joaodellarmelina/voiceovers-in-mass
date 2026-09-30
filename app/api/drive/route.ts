import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { clearToken, driveConfigured, readToken } from "@/lib/google-drive";

export async function GET() {
  try {
    const { userId } = await requireUser();
    const token = driveConfigured() ? await readToken(userId) : null;
    return Response.json({ configured: driveConfigured(), connected: !!token, email: token?.email });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Disconnects this user's Google account (revokes the token). Project links stay; sync pauses. */
export async function DELETE() {
  try {
    const { userId } = await requireUser();
    await clearToken(userId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
