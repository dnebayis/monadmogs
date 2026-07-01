const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const { execFileSync } = await import("node:child_process");
const { readFileSync } = await import("node:fs");
const { resolve } = await import("node:path");

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

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//.test(value);
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

await check("Mog metadata includes v0 links and rarity", async () => {
  const mog = await request("/api/v0/mogs/263");
  assert(mog.links?.render === "/api/v0/mogs/263/render", "render link is not v0");
  assert(mog.links?.rarity === "/api/v0/mogs/263/rarity", "rarity link is not v0");
  assert(mog.rarity?.tier === "legendary", "metadata rarity missing");
});

await check("agent registry count and list are KV shaped", async () => {
  const count = await request("/api/agents/count");
  assert(Number.isInteger(count.count), "agent count must be an integer");
  const list = await request("/api/agents/list?limit=5");
  assert(Number.isInteger(list.count), "agent list count must be an integer");
  assert(Array.isArray(list.agents), "agent list must include agents array");
  assert(list.limit === 5, "agent list should honor limit");
});

await check("known awakened Mog is present in registry index when bound", async () => {
  const binding = await request("/api/agents/binding/995");
  if (!binding.bound) return;
  const count = await request("/api/agents/count");
  const list = await request("/api/agents/list?limit=500");
  assert(count.count >= 1, "awakened registry count should include known bound Mog");
  assert(
    list.agents.some((agent) => String(agent.tokenId) === "995" && String(agent.agentId) === String(binding.binding.agentId)),
    "awakened registry list should include Mog #995",
  );
});

await check("agent discovery endpoints resolve known awakened Mog", async () => {
  const binding = await request("/api/agents/binding/995");
  if (!binding.bound) return;
  const agentId = binding.binding.agentId;
  const byAgent = await request(`/api/agents/by-agent-id/${agentId}`);
  assert(byAgent.bound === true, "by-agent-id should be bound");
  assert(byAgent.mog?.tokenId === 995, "by-agent-id mog mismatch");
  assert(byAgent.attribution?.level === "binding", "by-agent-id attribution level missing");

  const byAgentInfo = await request(`/api/agents/by-agent-id/${agentId}/info`);
  assert(byAgentInfo.tokenId === "995", "by-agent-id info token mismatch");
  assert(byAgentInfo.binding?.agentId === agentId, "by-agent-id info agent mismatch");

  const search = await request("/api/agents/search?q=995&limit=10");
  assert(search.agents?.some((agent) => String(agent.tokenId) === "995"), "search should find Mog #995");

  const identity = await request("/api/agents/identity/995");
  assert(identity.agentAwake === true, "identity should mark #995 awake");
  assert(identity.agentId === agentId, "identity agentId mismatch");
});

await check("batch binding handles mixed awakened and unawakened Mogs", async () => {
  const binding = await request("/api/agents/binding/995");
  if (!binding.bound) return;
  const list = await request("/api/agents/list?limit=500");
  const awakened = new Set(list.agents.map((agent) => Number(agent.tokenId)));
  const unawakened = Array.from({ length: 5000 }, (_, index) => index + 1).find((tokenId) => !awakened.has(tokenId));
  assert(unawakened, "expected at least one unawakened Mog");

  const batch = await postJson("/api/agents/binding/batch", { mogIds: [995, unawakened] });
  assert(batch.count === 2, "batch should return two unique results");
  assert(batch.results.some((result) => result.mogId === 995 && result.bound === true), "batch missing bound #995");
  assert(batch.results.some((result) => result.mogId === unawakened && result.bound === false), "batch missing unawakened result");

  const tooLarge = await postJson(
    "/api/agents/binding/batch",
    { mogIds: Array.from({ length: 101 }, (_, index) => index + 1) },
    400,
  );
  assert(tooLarge.error?.includes("1 to 100"), "batch max error mismatch");
});

await check("path binding endpoint returns awakened or unawakened shape", async () => {
  const binding = await request("/api/agents/binding/1");
  assert(binding.mogId === 1, "binding response mogId mismatch");
  assert(typeof binding.bound === "boolean", "binding response must include bound boolean");
  if (binding.bound) {
    assert(binding.binding?.agentId, "bound response missing agentId");
    assert(binding.agent?.agentURI, "bound response missing agentURI");
  } else {
    assert(binding.binding === null, "unawakened binding should be null");
  }
});

await check("persona tool returns deterministic persona without awakening", async () => {
  const persona = await postJson("/api/tools/mog-persona", { mogId: 263 });
  assert(persona.name === "Mog #263", "persona name mismatch");
  assert(persona.systemPrompt?.includes("Mog #263"), "persona system prompt missing token id");
  assert(Array.isArray(persona.safetyRails), "persona safety rails missing");

  const preview = await request("/api/agents/persona-preview/263");
  assert(preview.awakenedRequired === false, "persona preview should not require awakening");
  assert(preview.name === "Mog #263", "persona preview name mismatch");
});

await check("rarity tool returns rank and traits", async () => {
  const rarity = await postJson("/api/tools/mog-rarity", { mogId: 263 });
  assert(rarity.rank === 1, "rarity tool rank mismatch");
  assert(rarity.tier === "legendary", "rarity tool tier mismatch");
  assert(Array.isArray(rarity.attributes) && rarity.attributes.length === 9, "rarity tool traits missing");
});

await check("agent lookup tool accepts unawakened Mogs", async () => {
  const lookup = await postJson("/api/tools/mog-agent-lookup", { mogId: 1 });
  assert(lookup.mogId === 1, "lookup mogId mismatch");
  assert(typeof lookup.bound === "boolean", "lookup must include bound boolean");
});

await check("OpenSea tool manifests are same-origin and schema shaped", async () => {
  const slugs = ["mog-agent-lookup", "mog-persona", "mog-rarity"];
  const manifestType = "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1";
  for (const slug of slugs) {
    const manifest = await request(`/.well-known/ai-tool/${slug}.json`);
    assert(manifest.type === manifestType, `${slug} type mismatch`);
    assert(manifest.name && manifest.description, `${slug} name/description missing`);
    assert(manifest.endpoint === `${BASE_URL}/api/tools/${slug}` || isHttpUrl(manifest.endpoint), `${slug} endpoint invalid`);
    assert(manifest.inputs?.type === "object", `${slug} inputs schema missing`);
    assert(manifest.outputs?.type === "object", `${slug} outputs schema missing`);
    assert(/^0x[a-fA-F0-9]{40}$/.test(manifest.creatorAddress), `${slug} creatorAddress invalid`);
    assert(manifest.creatorAddress === manifest.creatorAddress.toLowerCase(), `${slug} creatorAddress must be lowercase`);
    assert(isHttpUrl(manifest.image), `${slug} image invalid`);
    assert(Array.isArray(manifest.tags), `${slug} tags missing`);
  }
});

await check("invalid tool inputs fail closed", async () => {
  const error = await postJson("/api/tools/mog-persona", { mogId: 0 }, 400);
  assert(error.error?.includes("between 1 and 5000"), "invalid mogId error mismatch");

  const searchError = await request("/api/agents/search?limit=0", 400);
  assert(searchError.error?.includes("limit"), "invalid search limit error mismatch");
});

await check("legacy query endpoints reject fractional ids", async () => {
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

await check("registries expose adapter and legacy binding addresses", async () => {
  const registries = await request("/api/agents/registries");
  assert(registries.identityRegistry === "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", "identity registry mismatch");
  assert(/^0x[a-fA-F0-9]{40}$/.test(registries.mogs8004Adapter), "adapter address invalid");
  assert(/^0x[a-fA-F0-9]{40}$/.test(registries.mogsAgentBindingsLegacy), "legacy binding address invalid");
  assert(registries.bindingSpec?.includes("eip-8217"), "binding spec link missing");
});

await check("RESTAP and AgentURI are gated to awakened Mogs", async () => {
  const binding = await request("/api/agents/binding/1");
  if (!binding.bound) {
    const metadata = await request("/api/agents/metadata/1", 404);
    assert(metadata.bound === false, "unawakened metadata should return bound false");
    const restap = await request("/api/agent-runtime/1/.well-known/restap.json", 404);
    assert(restap.bound === false, "unawakened RESTAP should return bound false");
    return;
  }
  const metadata = await request("/api/agents/metadata/1");
  assert(metadata.type === "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", "AgentURI type mismatch");
  assert(metadata.active === true, "AgentURI active flag missing");
  assert(metadata.x402Support === false, "AgentURI x402 flag mismatch");
  assert(metadata.registrations?.[0]?.agentRegistry?.startsWith("eip155:"), "AgentURI registration missing");
  assert(
    metadata.services?.some((service) => service.type === "RESTAP" && service.name === "RESTAP" && service.version),
    "AgentURI RESTAP service missing",
  );
  const restap = await request("/api/agent-runtime/1/.well-known/restap.json");
  assert(restap.capabilities?.walletSigning === false, "RESTAP v1 must not expose wallet signing");
});

await check("collection API exposes awake discovery", async () => {
  const binding = await request("/api/agents/binding/995");
  if (!binding.bound) return;

  const mog = await request("/api/v0/mogs/995");
  assert(mog.agentAwake === true, "single Mog metadata should expose agentAwake");
  assert(mog.agentId === binding.binding.agentId, "single Mog metadata agentId mismatch");

  const awake = await request("/api/v0/mogs?awake=true&limit=20");
  assert(awake.awake === true, "awake feed flag mismatch");
  assert(awake.items.some((item) => item.tokenId === 995 && item.agentAwake === true), "awake feed missing #995");

  const asleep = await request("/api/v0/mogs?awake=false&limit=20");
  assert(asleep.awake === false, "asleep feed flag mismatch");
  assert(asleep.items.every((item) => item.agentAwake === false), "asleep feed should only include unawakened Mogs");

  const rarity = await request("/api/v0/rarity");
  assert(rarity.awakenedCount >= 1, "rarity summary awakened count missing");
  assert(rarity.awakenedByTier && typeof rarity.awakenedByTier === "object", "rarity awakened tier summary missing");
});

await check("agent prompt and llms prioritize awakening over Arena", async () => {
  const prompt = await request("/agent-prompt.txt");
  const llms = await request("/llms.txt");
  assert(prompt.includes("version: 1.0.0"), "agent prompt version mismatch");
  assert(prompt.includes("registerMogAgent"), "agent prompt missing adapter registration");
  assert(prompt.includes("Do not join games or take Arena actions"), "agent prompt missing Arena deprioritization");
  assert(llms.includes("version: 1.0.0-agent-registry"), "llms version mismatch");
  assert(llms.includes("/api/agents/metadata/{mogId}"), "llms missing AgentURI endpoint");
  assert(llms.includes("/.well-known/ai-tool/mog-persona.json"), "llms missing tool manifest");
});

await check("home navigation hides Arena tab", async () => {
  const root = resolve(process.cwd(), "../..");
  const homeTabs = readFileSync(resolve(root, "apps/web/components/home-tabs.tsx"), "utf8");
  assert(!homeTabs.includes('label: "Arena"'), "Arena tab should not be in public home navigation");
});

await check("local runner dry-run sample still works for legacy Arena", async () => {
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
});

await check("arena game route still delegates to service layer", async () => {
  const root = resolve(process.cwd(), "../..");
  const route = readFileSync(resolve(root, "apps/api/app/api/arena/games/route.ts"), "utf8");
  const service = readFileSync(resolve(root, "apps/api/lib/arena-game-service.ts"), "utf8");
  assert(route.includes("joinArenaGameAction"), "games route should delegate join action");
  assert(route.includes("submitArenaMoveAction"), "games route should delegate move action");
  assert(route.includes("leaveArenaGameAction"), "games route should delegate leave action");
  assert(service.includes("Higher or Lower join must not include an opening move."), "higher-lower join guard should remain");
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
