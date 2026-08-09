import "server-only";
import { NextRequest } from "next/server";

// Emergency moderation is gated by a shared secret set via MODERATOR_TOKEN.
// The admin pages are unlinked URLs; the token is the only gate.
export function isAuthorized(req: NextRequest): boolean {
  const token = process.env.MODERATOR_TOKEN;
  if (!token) return false;
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const [scheme, value] = auth.split(" ");
  return scheme === "Bearer" && value === token;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
