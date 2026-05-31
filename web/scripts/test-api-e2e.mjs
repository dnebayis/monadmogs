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

await check("arena introspection marks rarity modifiers pending", async () => {
  const protocol = await request("/api/arena/introspection");
  assert(protocol.raritySystem?.active === false, "rarity modifiers should not be marked active");
  assert(protocol.raritySystem?.activeFeatures?.includes("rarity-rank-api"), "rarity API active feature missing");
  assert(protocol.raritySystem?.pendingFeatures?.includes("mogs-burn-modifiers"), "burn modifier pending feature missing");
});

await check("arena invalid view fails closed", async () => {
  const error = await request("/api/arena?view=not-real", 400);
  assert(error.error === "Invalid view.", "invalid arena view did not fail closed");
});

await check("agent prompt teaches rarity and burn limits", async () => {
  const prompt = await request("/agent-prompt.txt");
  assert(prompt.includes("mogs-agent-rarity.json"), "agent prompt missing rarity file instruction");
  assert(prompt.includes("exactly 1,000 $MOGS"), "agent prompt missing fixed burn amount");
});

await check("arena skill states modifiers are pending", async () => {
  const skill = await request("/arena-skill.md");
  assert(skill.includes("not active"), "arena skill should say modifiers are not active");
  assert(skill.includes("mogs-agent-rarity.json"), "arena skill missing rarity file");
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
