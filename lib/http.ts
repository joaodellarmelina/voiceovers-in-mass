import "server-only";
import { describeError } from "./elevenlabs";
import { DriveConfigError, DriveNotConnectedError } from "./google-drive";
import { UnauthorizedError } from "./auth";
import { NotFoundError } from "./store";

export function errorResponse(err: unknown) {
  if (err instanceof UnauthorizedError) return Response.json({ error: err.message }, { status: 401 });
  if (err instanceof NotFoundError) return Response.json({ error: "Não encontrado" }, { status: 404 });
  if (err instanceof DriveConfigError || err instanceof DriveNotConnectedError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  // Google API errors carry their own status and message (e.g. 404 folder not found / no access).
  const g = err as { code?: number; response?: { data?: { error?: { message?: string } } } };
  if (typeof g?.code === "number" && g.response?.data?.error?.message) {
    const status = g.code === 404 ? 404 : g.code >= 400 && g.code < 600 ? g.code : 502;
    const message = g.code === 404 ? "Pasta não encontrada, ou sua conta Google não tem acesso a ela." : g.response.data.error.message;
    return Response.json({ error: message }, { status });
  }
  const { status, message, fatal } = describeError(err);
  if (status >= 500 && !fatal) console.error(err);
  return Response.json({ error: message, fatal }, { status });
}
