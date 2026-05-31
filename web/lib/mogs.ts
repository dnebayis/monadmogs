import { createPublicClient, http } from "viem";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { MONAD_CHAIN, MONAD_EXPLORER_URL, MONAD_RPC_URL } from "@/lib/network";

export const MAX_SUPPLY = 5000;

export type MogAttribute = {
  trait_type: string;
  value: string;
};

export type MogMetadata = {
  tokenId: number;
  name: string;
  description?: string;
  image: string;
  attributes: MogAttribute[];
};

export const TRAIT_SCHEMA = {
  Background: ["Off-White", "Monad Purple", "Monad Blue", "Berry", "Terminal Black", "Finality Pink", "Mempool Grid", "Validator Map"],
  Body: ["Nad", "Pixel Bot", "Parallel Runner", "Mempool Ghost", "Block Builder", "Validator Kid"],
  Eyes: ["400ms Blink", "Diamond Eyes", "Sleepy Gmonad", "Terminal Scan", "Purple Rage", "Empty Mempool"],
  Mouth: ["GM", "Gmonad", "Cope Smile", "Finalized", "Reorg No", "Silent"],
  Head: ["Monad Cap", "Validator Halo", "Block Crown", "Gas Meter", "Purple Beanie", "No Hat", "Mempool Crown"],
  Hands: ["Faucet Cup", "Block Receipt", "Pixel Flag", "Keyboard", "Diamond", "Empty Hands"],
  Aura: ["Proposed", "Voted", "Finalized", "Verified", "Async", "Raptor", "None"],
  Glitch: ["None", "Low", "Parallel Split", "JIT Burn", "State Root"],
  "Meme Tag": ["gmonad", "400ms", "800ms", "no global mempool", "sendRawSync", "monanimal energy", "full onchain", "testnet relic"],
} as const;

export const TRAIT_GROUPS = Object.keys(TRAIT_SCHEMA);

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

export function parseTokenId(value: string) {
  const tokenId = Number(value);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > MAX_SUPPLY) return null;
  return tokenId;
}

export function decodeMetadataDataUri(uri: string) {
  const [, payload = ""] = uri.split(",");
  const json = Buffer.from(payload, "base64").toString("utf8");
  return JSON.parse(json) as Omit<MogMetadata, "tokenId">;
}

export function decodeImageDataUri(image: string) {
  const [header, payload = ""] = image.split(",");
  const mime = header.match(/^data:([^;]+);base64$/)?.[1] || "image/svg+xml";
  return {
    mime,
    body: Buffer.from(payload, "base64").toString("utf8"),
  };
}

export async function getMogMetadata(tokenId: number): Promise<MogMetadata> {
  const tokenURI = await client.readContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });

  return {
    ...decodeMetadataDataUri(tokenURI),
    tokenId,
  };
}

export async function getMogBatch(startTokenId: number, limit: number) {
  const start = Math.max(1, startTokenId);
  const end = Math.min(MAX_SUPPLY, start + limit - 1);
  const tokenIds = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);

  const results = await Promise.allSettled(tokenIds.map((tokenId) => getMogMetadata(tokenId)));

  return {
    start,
    end,
    items: results.flatMap((result) => (result.status === "fulfilled" ? [enrichMogMetadata(result.value)] : [])),
    nextCursor: end < MAX_SUPPLY ? end + 1 : null,
  };
}

export function enrichMogMetadata(metadata: MogMetadata) {
  return {
    ...metadata,
    links: {
      opensea: `https://opensea.io/assets/monad/${MONAD_MOGS_ADDRESS}/${metadata.tokenId}`,
      monadscan: `${MONAD_EXPLORER_URL}/token/${MONAD_MOGS_ADDRESS}?a=${metadata.tokenId}`,
      render: `/api/mogs/${metadata.tokenId}/render`,
      traits: `/api/mogs/${metadata.tokenId}/traits`,
      rarity: `/api/mogs/${metadata.tokenId}/rarity`,
    },
  };
}

export function immutableHeaders(contentType = "application/json") {
  return {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  };
}
