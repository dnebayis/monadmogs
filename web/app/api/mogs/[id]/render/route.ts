import { NextResponse, type NextRequest } from "next/server";
import { decodeImageDataUri, getMogMetadata, immutableHeaders, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tokenId = parseTokenId(id);

  if (!tokenId) {
    return NextResponse.json({ error: "Token id must be between 1 and 5000." }, { status: 400 });
  }

  const metadata = await getMogMetadata(tokenId);
  const image = decodeImageDataUri(metadata.image);

  return new NextResponse(image.body, {
    headers: immutableHeaders(image.mime),
  });
}
