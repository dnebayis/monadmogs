import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { apiUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const MAX_BATCH = 100;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const rawMogIds: unknown[] | null = Array.isArray(body.mogIds) ? body.mogIds : null;

  if (!rawMogIds) {
    return NextResponse.json({ error: "mogIds must be an array." }, { status: 400 });
  }
  if (rawMogIds.length < 1 || rawMogIds.length > MAX_BATCH) {
    return NextResponse.json({ error: `mogIds must include 1 to ${MAX_BATCH} token ids.` }, { status: 400 });
  }

  const mogIds = rawMogIds.map((value) => parseTokenId(String(value)));
  if (mogIds.some((mogId) => !mogId || mogId < 1 || mogId > MAX_SUPPLY)) {
    return NextResponse.json({ error: "Each mogId must be between 1 and 5000." }, { status: 400 });
  }

  const uniqueMogIds = [...new Set(mogIds as number[])];
  const results = await Promise.all(
    uniqueMogIds.map(async (mogId) => {
      const result = await getAgentByMog(mogId);
      if (!result) {
        return {
          mogId,
          bound: false,
          binding: null,
          render: apiUrl(`/api/v0/mogs/${mogId}/render`),
        };
      }
      return {
        mogId,
        bound: true,
        binding: {
          agentId: result.agent.agentId,
          tokenId: String(mogId),
          bindingContract: result.bindingContract,
          source: result.source,
        },
        agent: result.agent,
        mog: result.mog,
      };
    }),
  );

  return NextResponse.json(
    {
      count: results.length,
      results,
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
