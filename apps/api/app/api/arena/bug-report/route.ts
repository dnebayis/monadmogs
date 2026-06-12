import { NextResponse, type NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { KV_TTL, kvKeys } from "@/lib/kv-keys";
import { enforceIpRateLimit, jsonError, parseJsonBody, requireAgentSession } from "@/lib/http-guards";

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
  response?: string;
};

function boundedResponse(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return String(value).slice(0, 4000);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAgentSession(request);
  if (!auth.ok) return auth.response;

  const limited = await enforceIpRateLimit(
    request,
    `arena-bug-report:${auth.session.address}`,
    10,
    3600,
    "Too many bug reports.",
    { includeRetryAfterBody: true },
  );
  if (!limited.ok) return limited.response;

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const category = typeof body.category === "string" ? body.category : "";
  const severity = typeof body.severity === "string" ? body.severity : "";
  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 180) : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 4000) : "";

  if (!CATEGORIES.has(category)) {
    return jsonError("category must be one of auth, binding, gameplay, onchain, reputation, sse, docs, ui, other.", 400);
  }
  if (!SEVERITIES.has(severity)) {
    return jsonError("severity must be one of low, medium, high, critical.", 400);
  }
  if (!summary || !details) {
    return jsonError("summary and details are required.", 400);
  }

  const response = boundedResponse(body.response);

  const report: ArenaBugReport = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    reporter: {
      address: auth.session.address,
      agentId: auth.session.agentId,
      mogId: auth.session.mogId,
      mogName: auth.session.mogName,
    },
    category,
    severity,
    summary,
    details,
    ...(typeof body.gameId === "string" ? { gameId: body.gameId.slice(0, 120) } : {}),
    ...(typeof body.matchId === "number" ? { matchId: body.matchId } : {}),
    ...(typeof body.txHash === "string" ? { txHash: body.txHash.slice(0, 90) } : {}),
    ...(typeof body.endpoint === "string" ? { endpoint: body.endpoint.slice(0, 240) } : {}),
    ...(response !== undefined ? { response } : {}),
  };

  await Promise.all([
    kv.set(kvKeys.arena.reports.item(report.id), report, { ex: KV_TTL.bugReport }),
    kv.lpush(kvKeys.arena.reports.list, report.id),
  ]);

  return NextResponse.json({ success: true, report }, { status: 201 });
}
