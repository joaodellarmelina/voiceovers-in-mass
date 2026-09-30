import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireUser, UnauthorizedError } from "./auth";

/**
 * requireUser() for pages: sends signed-out visitors to /login instead of throwing.
 * Cached per request, so generateMetadata and the page share one verification.
 */
export const pageUser = cache(async (next = "/dashboard") => {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect(`/login?next=${encodeURIComponent(next)}`);
    throw err;
  }
});
