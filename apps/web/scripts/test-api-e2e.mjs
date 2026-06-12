const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

async function request(path, expectedStatus = 200) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json,text/plain,*/*" },
  });
  const text = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}: ${text.slice(0, 240)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }
  return text;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [];
async function check(name, fn) {
  checks.push(
    fn().then(
      () => ({ name, ok: true }),
      (error) => ({ name, ok: false, error }),
    ),
  );
}

await check("rarity summary exposes exact snapshot", async () => {
  const summary = await request("/api/v0/rarity");
  assert(summary.maxSupply === 5000, "rarity summary total supply mismatch");
  assert(summary.tiers?.legendary === "rank 1-50", "legendary tier boundary missing");
  assert(summary.traitFrequencies?.Background, "trait frequency table missing");
});

await check("known legendary Mog rarity is readable without ownership", async () => {
  const rarity = await request("/api/v0/mogs/263/rarity");
  assert(rarity.rank === 1, `expected Mog #263 rank 1, received ${rarity.rank}`);
  assert(rarity.tier === "legendary", `expected legendary, received ${rarity.tier}`);
  assert(Array.isArray(rarity.attributes) && rarity.attributes.length === 9, "rarity attributes missing");
});

await check("known common Mog rarity is readable", async () => {
  const rarity = await request("/api/v0/mogs/1/rarity");
  assert(rarity.tier === "common", `expected Mog #1 common, received ${rarity.tier}`);
  assert(rarity.rank > 2500, "common Mog rank should be over 2500");
});

await check("invalid Mog id returns controlled error", async () => {
  const error = await request("/api/v0/mogs/0/rarity", 400);
  assert(error.error?.includes("between 1 and 5000"), "invalid id error text mismatch");
});

await check("Mog metadata includes v0 links and rarity", async () => {
  const mog = await request("/api/v0/mogs/263");
  assert(mog.links?.render === "/api/v0/mogs/263/render", "render link is not v0");
  assert(mog.links?.rarity === "/api/v0/mogs/263/rarity", "rarity link is not v0");
  assert(mog.rarity?.tier === "legendary", "metadata rarity missing");
});

await check("AgentURI includes rarity service and rare-plus flag", async () => {
  const agentUri = await request(
    "/api/agents/uri?owner=0xf818A22f404337F86a1155937fB119a5b9438fD6&mogId=263&name=RareTester",
  );
  assert(agentUri.rarity?.tier === "legendary", "AgentURI rarity tier missing");
  assert(agentUri.rarity?.isRarePlus === true, "AgentURI rare-plus flag missing");
  assert(agentUri.services?.some((service) => service.name === "rarity"), "AgentURI rarity service missing");
});

await check("arena introspection marks Special Move active", async () => {
  const protocol = await request("/api/arena/introspection");
  assert(protocol.version === "0.7.0", `expected protocol 0.7.0, received ${protocol.version}`);
  assert(protocol.raritySystem?.active === true, "Special Move should be marked active");
  assert(protocol.raritySystem?.term === "Special Move", "Special Move term missing");
  assert(protocol.raritySystem?.activeFeatures?.includes("rarity-rank-api"), "rarity API active feature missing");
  assert(protocol.raritySystem?.supportedGames?.includes("dice-duel"), "Dice Duel Special Move support missing");
  assert(protocol.raritySystem?.supportedGames?.includes("higher-lower"), "Higher or Lower Special Move support missing");
  assert(protocol.raritySystem?.burnAmount === "1000", "Special Move burn amount mismatch");
  assert(protocol.endpoints?.pendingActions?.includes("/api/arena/pending-actions"), "pending-actions endpoint missing");
  assert(protocol.endpoints?.agentStatus?.includes("/api/arena/agent/status"), "agent/status endpoint missing");
  assert(protocol.endpoints?.bugReport?.includes("/api/arena/bug-report"), "bug-report endpoint missing");
  assert(protocol.gameSkills?.diceDuel?.includes("/skills/dice-duel.md"), "dice-duel skill missing");
});

await check("arena invalid view fails closed", async () => {
  const error = await request("/api/arena?view=not-real", 400);
  assert(error.error === "Invalid view.", "invalid arena view did not fail closed");
});

await check("agent prompt teaches rarity and burn limits", async () => {
  const prompt = await request("/agent-prompt.txt");
  assert(prompt.includes("version: 0.7.0"), "agent prompt version mismatch");
  assert(prompt.includes("/api/arena/pending-actions"), "agent prompt missing pending-actions");
  assert(prompt.includes("mogs-agent-rarity.json"), "agent prompt missing rarity file instruction");
  assert(prompt.includes("exactly 1,000 $MOGS"), "agent prompt missing fixed burn amount");
});

await check("arena skill states Special Move rules", async () => {
  const skill = await request("/arena-skill.md");
  assert(skill.includes("version: 0.7.0"), "arena skill version mismatch");
  assert(skill.includes("/api/arena/pending-actions"), "arena skill missing pending-actions");
  assert(skill.includes("Dice Duel"), "arena skill missing game skill links");
});

await check("arena auth-only endpoints fail closed without bearer token", async () => {
  const pending = await request("/api/arena/pending-actions", 401);
  assert(pending.error?.includes("Authentication required"), "pending-actions should require auth");
  const status = await request("/api/arena/agent/status", 401);
  assert(status.error?.includes("Authentication required"), "agent/status should require auth");
  const report = await fetch(`${BASE_URL}/api/arena/bug-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "other", severity: "low", summary: "x", details: "x" }),
  });
  assert(report.status === 401, `bug-report should require auth, received ${report.status}`);
});

await check("agent id routes reject fractional ids", async () => {
  const paths = [
    "/api/agents/lookup?agentId=1.2",
    "/api/agents/profile?agentId=1.2",
    "/api/agents/binding?agentId=1.2",
  ];
  for (const path of paths) {
    const error = await request(path, 400);
    assert(error.error === "agentId must be a positive integer.", `${path} did not reject fractional agentId`);
  }
});

await check("arena season exposes eligibility", async () => {
  const season = await request("/api/arena/season");
  assert(season.seasonId === "season-0", "season id missing");
  assert(season.leaderboardMode === "practice", "practice leaderboard mode missing");
  assert(season.eligibleGames?.includes("higher-lower"), "eligible games missing");
  assert(season.requirements?.some((item) => item.includes("ERC-8217")), "ERC-8217 requirement missing");
});

await check("game-specific skills are readable", async () => {
  const files = [
    ["/skills/coin-flip.md", "Coin Flip"],
    ["/skills/rock-paper-scissors.md", "Rock Paper Scissors"],
    ["/skills/dice-duel.md", "Dice Duel"],
    ["/skills/higher-lower.md", "Higher or Lower"],
  ];
  for (const [path, title] of files) {
    const text = await request(path);
    assert(text.includes(title), `${path} missing ${title}`);
    assert(text.includes("version: 0.7.0"), `${path} version mismatch`);
  }
});

const results = await Promise.all(checks);
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
  if (!result.ok) console.error(result.error);
}

if (failures.length > 0) {
  process.exitCode = 1;
}
