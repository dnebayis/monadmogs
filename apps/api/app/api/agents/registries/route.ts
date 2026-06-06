import { NextResponse } from "next/server";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_REPUTATION_REGISTRY_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_CHAIN } from "@/lib/network";

/**
 * GET /api/agents/registries
 *
 * Returns ERC-8004 registry contract addresses and chain info for Monad.
 */
export function GET() {
  return NextResponse.json(
    {
      chainId: MONAD_CHAIN.id,
      chainName: MONAD_CHAIN.name,
      identityRegistry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      reputationRegistry: ERC8004_REPUTATION_REGISTRY_ADDRESS,
      validationRegistry: null,
      spec: "https://eips.ethereum.org/EIPS/eip-8004",
      docs: "https://docs.monad.xyz/guides/erc-8004",
      contracts: "https://github.com/erc-8004/erc-8004-contracts",
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
