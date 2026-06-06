import { createPublicClient, http } from "viem";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MAX_SUPPLY = 5000;
const CONTRACT = process.env.NEXT_PUBLIC_MONAD_MOGS_ADDRESS || "0x1414f3BAF22404C42fD656af4aFAab4934045137";
const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://rpc.monad.xyz";
const OUT = resolve("data/rarity.json");
const CONCURRENCY = Number(process.env.RARITY_CONCURRENCY || "8");
const MAX_RETRIES = Number(process.env.RARITY_MAX_RETRIES || "8");

const ABI = [
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "string" }],
  },
];

const client = createPublicClient({
  chain: {
    id: 143,
    name: "Monad Mainnet",
    nativeCurrency: { decimals: 18, name: "Monad", symbol: "MON" },
    rpcUrls: { default: { http: [RPC_URL] } },
  },
  transport: http(RPC_URL),
});

function decodeMetadataDataUri(uri) {
  const [, payload = ""] = uri.split(",");
  return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isRateLimit(error) {
  const text = String(error?.shortMessage || error?.message || error);
  return text.includes("429") || text.includes("Too Many Requests");
}

async function fetchToken(tokenId) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tokenURI = await client.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });
      const metadata = decodeMetadataDataUri(tokenURI);
      return {
        tokenId,
        name: metadata.name,
        attributes: metadata.attributes,
      };
    } catch (error) {
      lastError = error;
      const baseDelay = isRateLimit(error) ? 1500 : 400;
      const delay = baseDelay * Math.min(8, attempt + 1);
      console.log(`Retry token ${tokenId} after ${delay}ms (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
      if ((index + 1) % 250 === 0) {
        console.log(`Fetched ${index + 1}/${items.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function tierForRank(rank) {
  if (rank <= 50) return "legendary";
  if (rank <= 250) return "epic";
  if (rank <= 1000) return "rare";
  if (rank <= 2500) return "uncommon";
  return "common";
}

function main() {
  return (async () => {
    const tokenIds = Array.from({ length: MAX_SUPPLY }, (_, index) => index + 1);
    const tokens = await mapWithConcurrency(tokenIds, CONCURRENCY, fetchToken);

    const counts = {};
    for (const token of tokens) {
      for (const attribute of token.attributes) {
        counts[attribute.trait_type] ||= {};
        counts[attribute.trait_type][attribute.value] ||= 0;
        counts[attribute.trait_type][attribute.value]++;
      }
    }

    const scored = tokens.map((token) => {
      const attributes = token.attributes.map((attribute) => {
        const frequency = counts[attribute.trait_type][attribute.value];
        const score = MAX_SUPPLY / frequency;
        return {
          trait_type: attribute.trait_type,
          value: attribute.value,
          frequency,
          percentage: Number(((frequency / MAX_SUPPLY) * 100).toFixed(4)),
          score: Number(score.toFixed(6)),
        };
      });
      const score = attributes.reduce((sum, attribute) => sum + attribute.score, 0);
      return {
        tokenId: token.tokenId,
        name: token.name,
        score,
        attributes,
      };
    });

    scored.sort((a, b) => b.score - a.score || a.tokenId - b.tokenId);

    const byTokenId = {};
    scored.forEach((token, index) => {
      const rank = index + 1;
      byTokenId[token.tokenId] = {
        tokenId: token.tokenId,
        name: token.name,
        rank,
        tier: tierForRank(rank),
        percentile: Number(((rank / MAX_SUPPLY) * 100).toFixed(2)),
        score: Number(token.score.toFixed(6)),
        attributes: token.attributes,
      };
    });

    const snapshot = {
      generatedAt: new Date().toISOString(),
      source: {
        chainId: 143,
        contract: CONTRACT,
        method: "onchain tokenURI snapshot",
        maxSupply: MAX_SUPPLY,
      },
      methodology: {
        traitScore: "MAX_SUPPLY / trait_value_frequency",
        totalScore: "sum of all trait scores for the token",
        ranking: "descending totalScore, tokenId ascending as deterministic tiebreaker",
        tiers: {
          legendary: "rank 1-50",
          epic: "rank 51-250",
          rare: "rank 251-1000",
          uncommon: "rank 1001-2500",
          common: "rank 2501-5000",
        },
      },
      traitFrequencies: counts,
      tokens: byTokenId,
    };

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, `${JSON.stringify(snapshot)}\n`);
    console.log(`Wrote ${OUT}`);
  })();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
