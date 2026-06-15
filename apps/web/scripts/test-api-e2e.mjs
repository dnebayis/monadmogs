const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const { readFileSync } = await import("node:fs");
const { resolve } = await import("node:path");
const { execFileSync } = await import("node:child_process");

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

async function postJson(path, body, expectedStatus = 200, headers = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}: ${text.slice(0, 240)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? JSON.parse(text) : text;
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
  assert(protocol.version === "0.8.0", `expected protocol 0.8.0, received ${protocol.version}`);
  assert(protocol.raritySystem?.active === true, "Special Move should be marked active");
  assert(protocol.raritySystem?.term === "Special Move", "Special Move term missing");
  assert(protocol.raritySystem?.activeFeatures?.includes("rarity-rank-api"), "rarity API active feature missing");
  assert(protocol.raritySystem?.supportedGames?.includes("dice-duel"), "Dice Duel Special Move support missing");
  assert(protocol.raritySystem?.supportedGames?.includes("higher-lower"), "Higher or Lower Special Move support missing");
  assert(protocol.raritySystem?.burnAmount === "1000", "Special Move burn amount mismatch");
  assert(protocol.endpoints?.pendingActions?.includes("/api/arena/pending-actions"), "pending-actions endpoint missing");
  assert(protocol.endpoints?.agentStatus?.includes("/api/arena/agent/status"), "agent/status endpoint missing");
  assert(protocol.endpoints?.bugReport?.includes("/api/arena/bug-report"), "bug-report endpoint missing");
  assert(protocol.endpoints?.receipt?.includes("/api/arena/receipts"), "receipt endpoint missing");
  assert(protocol.receipts?.privacy?.includes("public-safe"), "receipt privacy note missing");
  assert(protocol.permissions?.fields?.includes("allowBurnSpecialMove"), "permission profile fields missing");
  assert(protocol.gameSkills?.diceDuel?.includes("/skills/dice-duel.md"), "dice-duel skill missing");
});

await check("arena invalid view fails closed", async () => {
  const error = await request("/api/arena?view=not-real", 400);
  assert(error.error === "Invalid view.", "invalid arena view did not fail closed");
});

await check("agent prompt teaches rarity and burn limits", async () => {
  const prompt = await request("/agent-prompt.txt");
  assert(prompt.includes("version: 0.8.0"), "agent prompt version mismatch");
  assert(prompt.includes("/api/arena/pending-actions"), "agent prompt missing pending-actions");
  assert(prompt.includes("/api/arena/receipts?gameId={gameId}"), "agent prompt missing receipts");
  assert(prompt.includes("allowBurnSpecialMove"), "agent prompt missing permission profile burn control");
  assert(prompt.includes("mogs-agent-rarity.json"), "agent prompt missing rarity file instruction");
  assert(prompt.includes("exactly 1,000 $MOGS"), "agent prompt missing fixed burn amount");
});

await check("arena skill states Special Move rules", async () => {
  const skill = await request("/arena-skill.md");
  assert(skill.includes("version: 0.8.0"), "arena skill version mismatch");
  assert(skill.includes("/api/arena/pending-actions"), "arena skill missing pending-actions");
  assert(skill.includes("/api/arena/receipts?gameId={gameId}"), "arena skill missing receipts");
  assert(skill.includes("mogs-agent-permissions.json"), "arena skill missing permissions file");
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

await check("arena game mutations fail closed without bearer token", async () => {
  const join = await postJson("/api/arena/games", { action: "join", gameId: "missing" }, 401);
  assert(join.error?.includes("Authentication required"), "join should require auth");
  const move = await postJson("/api/arena/games", { action: "move", gameId: "missing", move: "heads" }, 401);
  assert(move.error?.includes("Authentication required"), "move should require auth");
  const leave = await postJson("/api/arena/games", { action: "leave", gameId: "missing" }, 401);
  assert(leave.error?.includes("Authentication required"), "leave should require auth");
});

await check("arena admin create fails closed without valid secret", async () => {
  const error = await postJson("/api/arena/games", { action: "create", type: "coin-flip" }, 403);
  assert(error.error === "Only the arena admin can create games.", "admin create should require x-admin-secret");
});

await check("arena admin health fails closed without valid secret", async () => {
  const error = await postJson("/api/arena/admin", { action: "arena-health" }, 401);
  assert(error.error === "Unauthorized.", "arena-health should require x-admin-secret");
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
  assert(season.scoring?.win === 10, "season scoring win missing");
  assert(season.prizes?.status === "practice", "season prize status missing");
  assert(season.tournament?.format === "leaderboard", "season tournament format missing");
  assert(season.eligibleGames?.includes("higher-lower"), "eligible games missing");
  assert(season.requirements?.some((item) => item.includes("ERC-8217")), "ERC-8217 requirement missing");
});

await check("receipt endpoint validates game id", async () => {
  const missing = await request("/api/arena/receipts", 400);
  assert(missing.error === "gameId is required.", "receipt missing gameId error mismatch");
  const notFound = await request("/api/arena/receipts?gameId=not-a-real-game", 404);
  assert(notFound.error === "Game not found.", "receipt missing game error mismatch");
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
    assert(text.includes("version: 0.8.0"), `${path} version mismatch`);
    assert(text.includes("/api/arena/receipts?gameId={gameId}"), `${path} missing receipt note`);
  }
});

await check("local runner dry-run sample proposes a move without mutation", async () => {
  const root = resolve(process.cwd(), "../..");
  const output = execFileSync(
    "node",
    [resolve(root, "apps/api/scripts/arena-runner.mjs"), "--dry-run", "--sample"],
    { encoding: "utf8" },
  );
  const result = JSON.parse(output);
  assert(result.mode === "dry-run", "runner sample should be dry-run");
  assert(result.nextAction === "submit_move", "runner sample should produce submit_move");
  assert(result.plannedMove === "lower", "runner should choose lower for currentNumber 72");
  assert(result.permission?.ok === true, "runner permission check should pass sample");
});

await check("arena docs and prompts avoid external source names", async () => {
  const docs = [
    await request("/llms.txt"),
    await request("/agent-prompt.txt"),
    await request("/arena-skill.md"),
  ].join("\n");
  const blocked = new RegExp(["dev", "\\.fun|", "dev", "fun"].join(""), "i");
  assert(!blocked.test(docs), "agent-facing docs should not mention external source names");
});

await check("arena game route delegates to service layer", async () => {
  const root = resolve(process.cwd(), "../..");
  const route = readFileSync(resolve(root, "apps/api/app/api/arena/games/route.ts"), "utf8");
  const service = readFileSync(resolve(root, "apps/api/lib/arena-game-service.ts"), "utf8");
  const health = readFileSync(resolve(root, "apps/api/lib/arena-health.ts"), "utf8");
  const permissions = readFileSync(resolve(root, "apps/api/lib/arena-permissions.ts"), "utf8");
  const observability = readFileSync(resolve(root, "apps/api/lib/arena-observability.ts"), "utf8");
  assert(route.includes("joinArenaGameAction"), "games route should delegate join action");
  assert(route.includes("submitArenaMoveAction"), "games route should delegate move action");
  assert(route.includes("leaveArenaGameAction"), "games route should delegate leave action");
  assert(service.includes("export async function validateSpecialMove"), "validateSpecialMove should be exported for tests");
  assert(service.includes("Move already submitted for this round."), "duplicate move guard should live in service");
  assert(health.includes("failed_reputation_feedback"), "arena health should include reputation failures");
  assert(permissions.includes("allowBurnSpecialMove: profile?.allowBurnSpecialMove === true"), "burn permission should default closed");
  assert(permissions.includes("maxEntryFeeWei"), "permission profile should check max entry fee");
  assert(observability.includes("[redacted]"), "operational errors should be redacted");
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
