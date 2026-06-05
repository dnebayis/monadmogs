import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { parseTokenId, MAX_SUPPLY } from "@/lib/mogs";
import { apiUrl } from "@/lib/urls";

/**
 * GET /api/mogs/{id}/agent
 *
 * Convenience redirect to /api/agents/by-mog?mogId={id}.
 * Makes the binding discoverable from the Mog's own API namespace.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`mog-agent:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { id } = await params;
  const mogId = parseTokenId(id);

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "Token ID must be between 1 and 5000." }, { status: 400 });
  }

  const target = apiUrl(`/api/agents/by-mog?mogId=${mogId}`);
  return NextResponse.redirect(target, { status: 302 });
}
