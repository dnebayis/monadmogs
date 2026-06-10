import { NextResponse, type NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { validateAuthHeader } from "@/lib/arena-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { KV_TTL, kvKeys } from "@/lib/kv-keys";

const CATEGORIES = new Set([
  "auth",
  "binding",
  "gameplay",
  "onchain",
  "reputation",
  "sse",
  "docs",
  "ui",
  "other",
]);

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

export type ArenaBugReport = {
  id: string;
  createdAt: string;
  reporter: {
    address: string;
    agentId: number;
    mogId: number;
    mogName: string;
  };
  category: string;
  severity: string;
  summary: string;
  details: string;
  gameId?: string;
  matchId?: number;
  txHash?: string;
  endpoint?: string;
  response?: unknown;
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const session = await validateAuthHeader(request.headers.get("authorization"));
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required. Use POST /api/arena/auth to get a session token." },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`arena-bug-report:${session.address}:${ip}`, 10, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many bug reports.", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "";
  const severity = typeof body.severity === "string" ? body.severity : "";
  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 180) : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 4000) : "";

  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "category must be one of auth, binding, gameplay, onchain, reputation, sse, docs, ui, other." }, { status: 400 });
  }
  if (!SEVERITIES.has(severity)) {
    return NextResponse.json({ error: "severity must be one of low, medium, high, critical." }, { status: 400 });
  }
  if (!summary || !details) {
    return NextResponse.json({ error: "summary and details are required." }, { status: 400 });
  }

  const report: ArenaBugReport = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    reporter: {
      address: session.address,
      agentId: session.agentId,
      mogId: session.mogId,
      mogName: session.mogName,
    },
    category,
    severity,
    summary,
    details,
    ...(typeof body.gameId === "string" ? { gameId: body.gameId.slice(0, 120) } : {}),
    ...(typeof body.matchId === "number" ? { matchId: body.matchId } : {}),
    ...(typeof body.txHash === "string" ? { txHash: body.txHash.slice(0, 90) } : {}),
    ...(typeof body.endpoint === "string" ? { endpoint: body.endpoint.slice(0, 240) } : {}),
    ...(body.response !== undefined ? { response: body.response } : {}),
  };

  await Promise.all([
    kv.set(kvKeys.arena.reports.item(report.id), report, { ex: KV_TTL.bugReport }),
    kv.lpush(kvKeys.arena.reports.list, report.id),
  ]);

  return NextResponse.json({ success: true, report }, { status: 201 });
}
