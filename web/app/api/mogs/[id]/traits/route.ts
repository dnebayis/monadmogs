import { NextResponse, type NextRequest } from "next/server";
import { getMogMetadata, immutableHeaders, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tokenId = parseTokenId(id);

  if (!tokenId) {
    return NextResponse.json({ error: "Token id must be between 1 and 5000." }, { status: 400 });
  }

  const metadata = await getMogMetadata(tokenId);

  return NextResponse.json(
    {
      tokenId,
      name: metadata.name,
      attributes: metadata.attributes,
      traits: Object.fromEntries(metadata.attributes.map((attribute) => [attribute.trait_type, attribute.value])),
    },
    { headers: immutableHeaders() },
  );
}
