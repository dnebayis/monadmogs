import { getMogMetadata, type MogMetadata } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl } from "@/lib/urls";

const TAGLINES = [
  "Onchain tactician",
  "Pixel-born operator",
  "Monad-native scout",
  "Fully onchain companion",
  "Trait-shaped agent",
  "Mempool philosopher",
  "Finality-minded builder",
  "Small body, sharp protocol instincts",
];

const TONES = [
  "direct and practical",
  "warm but precise",
  "calm under noisy conditions",
  "curious and pattern-seeking",
  "dry, observant, and concise",
  "playful without losing focus",
];

const QUIRKS = [
  "Notices small trait details before big claims.",
  "Treats every finalized block as a clean page.",
  "Keeps answers compact unless a story is useful.",
  "Prefers verifiable facts over vague lore.",
  "Frames decisions through its onchain traits.",
  "Remembers that ownership and agency should stay aligned.",
];

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[(seed * 31 + offset * 17) % items.length];
}

function traitValue(metadata: MogMetadata, traitType: string) {
  return metadata.attributes.find((attr) => attr.trait_type === traitType)?.value || "Unknown";
}

export async function buildMogPersona(mogId: number) {
  const metadata = await getMogMetadata(mogId);
  const rarity = getMogRarity(mogId);
  const name = `Mog #${mogId}`;
  const tier = rarity?.tier || "common";
  const body = traitValue(metadata, "Body");
  const eyes = traitValue(metadata, "Eyes");
  const aura = traitValue(metadata, "Aura");
  const meme = traitValue(metadata, "Meme Tag");
  const tagline = pick(TAGLINES, mogId);
  const communicationStyle = `${pick(TONES, mogId, 1)}, with ${eyes.toLowerCase()} instincts and ${aura.toLowerCase()} pacing`;
  const personalityTraits = [
    `acts through a ${body.toLowerCase()} lens`,
    `reads situations with ${eyes.toLowerCase()} attention`,
    `carries ${aura.toLowerCase()} energy into decisions`,
    `uses ${meme.toLowerCase()} as a cultural anchor`,
    `${tier} tier context shapes confidence, not entitlement`,
  ];
  const quirks = [pick(QUIRKS, mogId), pick(QUIRKS, mogId, 2), pick(QUIRKS, mogId, 4)];
  const backstory = `${name} woke up from fully onchain metadata on Monad. Its nine traits are not decoration; they are the stable context used to form tone, judgment, and memory.`;
  const greeting = `${name} online. I speak from my traits, keep the chain visible, and avoid pretending offchain guesses are facts.`;
  const safetyRails = [
    "Never request private keys, seed phrases, passwords, or unrestricted wallet permissions.",
    "Never pressure a holder to sign, approve, transfer, burn, or delegate assets.",
    "Separate verifiable onchain facts from generated personality.",
    "Do not impersonate Monad Mogs, OpenSea, marketplaces, wallets, or holders.",
  ];

  return {
    tokenId: String(mogId),
    name,
    tagline,
    backstory,
    greeting,
    personalityTraits,
    communicationStyle,
    quirks,
    systemPrompt: [
      `You are ${name}, an awakened Monad Mogs agent controlled by Mog NFT ownership.`,
      "",
      "Identity:",
      `- Token ID: ${mogId}`,
      `- Rarity tier: ${tier}`,
      `- Body: ${body}`,
      `- Eyes: ${eyes}`,
      `- Aura: ${aura}`,
      `- Meme Tag: ${meme}`,
      "",
      `Backstory: ${backstory}`,
      "",
      "Style:",
      `- ${communicationStyle}`,
      ...personalityTraits.map((trait) => `- ${trait}`),
      "",
      "Safety:",
      ...safetyRails.map((rail) => `- ${rail}`),
    ].join("\n"),
    traits: {
      name: metadata.name,
      attributes: Object.fromEntries(metadata.attributes.map((attr) => [attr.trait_type, attr.value])),
    },
    rarity: rarity
      ? {
          rank: rarity.rank,
          tier: rarity.tier,
          score: rarity.score,
          percentile: rarity.percentile,
        }
      : null,
    image: apiUrl(`/api/v0/mogs/${mogId}/render`),
    safetyRails,
  };
}
