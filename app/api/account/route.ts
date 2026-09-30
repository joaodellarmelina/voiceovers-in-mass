import { elevenlabs } from "@/lib/elevenlabs";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireUser();
    const sub = await elevenlabs().user.subscription.get();
    return Response.json({
      tier: sub.tier,
      used: sub.characterCount,
      limit: sub.characterLimit,
      remaining: Math.max(0, sub.characterLimit - sub.characterCount),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
