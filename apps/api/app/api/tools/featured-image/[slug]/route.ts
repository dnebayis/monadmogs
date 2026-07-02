import { NextResponse, type NextRequest } from "next/server";

const TOOLS = {
  "mog-agent-lookup": {
    title: "Agent Lookup",
    subtitle: "ERC-8217 Mog binding discovery",
    accent: "#85e6ff",
    gated: false,
  },
  "mog-persona": {
    title: "Mog Persona",
    subtitle: "Deterministic agent context",
    accent: "#ff8ee4",
    gated: false,
  },
  "mog-rarity": {
    title: "Mog Rarity",
    subtitle: "Traits, tier, rank, and score",
    accent: "#ffe8a3",
    gated: false,
  },
  "mog-holder-portfolio": {
    title: "Holder Portfolio",
    subtitle: "Verified holdings and agent status",
    accent: "#95ffba",
    gated: true,
  },
  "mog-holder-mission-brief": {
    title: "Mission Brief",
    subtitle: "Holder-verified agent context",
    accent: "#ffb86f",
    gated: true,
  },
  "mog-market-radar": {
    title: "Market Radar",
    subtitle: "Rarity and awakening signals",
    accent: "#b8a7ff",
    gated: true,
  },
} as const;

type ToolSlug = keyof typeof TOOLS;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvg(slug: ToolSlug) {
  const tool = TOOLS[slug];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="Monad Mogs ${escapeXml(tool.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070711"/>
      <stop offset="0.52" stop-color="#17102c"/>
      <stop offset="1" stop-color="#05080c"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <rect x="86" y="92" width="1028" height="491" rx="24" fill="#0d0d16" fill-opacity=".72" stroke="#ffffff" stroke-opacity=".16"/>
  <rect x="118" y="124" width="150" height="150" rx="20" fill="${tool.accent}" fill-opacity=".14" stroke="${tool.accent}" stroke-opacity=".9"/>
  <rect x="150" y="164" width="86" height="70" rx="12" fill="${tool.accent}"/>
  <rect x="170" y="184" width="14" height="14" fill="#070711"/>
  <rect x="202" y="184" width="14" height="14" fill="#070711"/>
  <rect x="176" y="216" width="34" height="8" fill="#070711" opacity=".9"/>
  <text x="312" y="174" fill="${tool.accent}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28" font-weight="700" letter-spacing="4">MONAD MOGS</text>
  <text x="312" y="272" fill="#fbfaf9" font-family="Inter, Arial, sans-serif" font-size="78" font-weight="800">${escapeXml(tool.title)}</text>
  <text x="316" y="334" fill="#b9b5c8" font-family="Inter, Arial, sans-serif" font-size="34">${escapeXml(tool.subtitle)}</text>
  <text x="118" y="520" fill="#fbfaf9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28">${tool.gated ? "Holder-gated ERC-8257 tool" : "Open-access ERC-8257 tool on Base"}</text>
  <text x="118" y="558" fill="#8f8aa3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">api.monadmogs.xyz/.well-known/ai-tool/${slug}.json</text>
</svg>`;
}

export function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    if (!(slug in TOOLS)) {
      return NextResponse.json({ error: "Unknown tool." }, { status: 404 });
    }

    return new NextResponse(buildSvg(slug as ToolSlug), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  });
}
