import { rateLimitClaim } from "@/lib/ownership/claim";
import { issueClaimChallenge } from "@/lib/ownership/claim-session";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    await rateLimitClaim(request);
    await issueClaimChallenge();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
