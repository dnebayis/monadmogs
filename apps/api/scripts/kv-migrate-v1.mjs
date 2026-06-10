import fs from "node:fs";

let kv;

const legacy = {
  studioProjects: "studio:projects",
  gamesList: "arena:games",
  game: (gameId) => `arena:game:${gameId}`,
  matchByGame: (gameId) => `arena:game-match:${gameId}`,
  gameByMatch: (matchId) => `arena:match-game:${matchId}`,
  resolve: (gameId) => `arena:game-resolve:${gameId}`,
  leaderboard: "arena:leaderboard",
  stats: (address) => `arena:stats:${String(address).toLowerCase()}`,
  reportList: "arena:bug-reports",
  report: (id) => `arena:bug-report:${id}`,
};

const next = {
  studioProjects: "studio:v1:projects",
  gamesList: "arena:v1:games:list",
  game: (gameId) => `arena:v1:games:${gameId}`,
  matchByGame: (gameId) => `arena:v1:matches:byGame:${gameId}`,
  gameByMatch: (matchId) => `arena:v1:matches:byMatch:${matchId}`,
  resolve: (gameId) => `arena:v1:resolves:${gameId}`,
  leaderboard: "arena:v1:leaderboard",
  stats: (address) => `arena:v1:players:stats:${String(address).toLowerCase()}`,
  reportList: "arena:v1:reports:list",
  report: (id) => `arena:v1:reports:${id}`,
};

const args = new Set(process.argv.slice(2));
const argv = process.argv.slice(2);
const mode = args.has("--copy")
  ? "copy"
  : args.has("--verify")
    ? "verify"
    : args.has("--cleanup")
      ? "cleanup"
      : "dry-run";

const confirmedDelete = process.env.CONFIRM_DELETE_LEGACY_KV === "DELETE_LEGACY_KV";

function readArgValue(name) {
  const withEquals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1];
  return undefined;
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function log(label, value = "") {
  console.log(value === "" ? label : `${label}: ${value}`);
}

async function readList(key) {
  return await kv.lrange(key, 0, -1).catch(() => []);
}

async function writeListPreservingOrder(key, values) {
  await kv.del(key);
  for (let i = values.length - 1; i >= 0; i--) {
    await kv.lpush(key, values[i]);
  }
}

async function copyIfExists(from, to, options = {}) {
  const value = await kv.get(from);
  if (value === null || value === undefined) return false;
  await kv.set(to, value, options);
  return true;
}

async function compareValue(from, to) {
  const [a, b] = await Promise.all([kv.get(from), kv.get(to)]);
  return JSON.stringify(a) === JSON.stringify(b);
}

async function collectPlan() {
  const gameIds = await readList(legacy.gamesList);
  const reportIds = await readList(legacy.reportList);
  const studioProjects = await readList(legacy.studioProjects);
  const leaderboardAddresses = await kv.zrange(legacy.leaderboard, 0, -1).catch(() => []);

  const gameMatchIds = [];
  const gameResolveIds = [];
  for (const gameId of gameIds) {
    const [matchId, resolve] = await Promise.all([
      kv.get(legacy.matchByGame(gameId)),
      kv.get(legacy.resolve(gameId)),
    ]);
    if (matchId !== null && matchId !== undefined) gameMatchIds.push({ gameId, matchId });
    if (resolve !== null && resolve !== undefined) gameResolveIds.push(gameId);
  }

  return {
    gameIds,
    gameMatchIds,
    gameResolveIds,
    reportIds,
    studioProjects,
    leaderboardAddresses,
  };
}

async function dryRun(plan) {
  log("KV migration dry-run");
  log("games", plan.gameIds.length);
  log("game match links", plan.gameMatchIds.length);
  log("game resolve records", plan.gameResolveIds.length);
  log("leaderboard addresses", plan.leaderboardAddresses.length);
  log("bug reports", plan.reportIds.length);
  log("studio projects", plan.studioProjects.length);
  log("next copy command", "pnpm --filter monad-mogs-api kv:migrate:copy");
  log("next verify command", "pnpm --filter monad-mogs-api kv:migrate:verify");
}

async function copy(plan) {
  log("Copying legacy KV keys to v1 namespace");

  await writeListPreservingOrder(next.gamesList, plan.gameIds);
  for (const gameId of plan.gameIds) {
    await copyIfExists(legacy.game(gameId), next.game(gameId));
  }
  for (const { gameId, matchId } of plan.gameMatchIds) {
    await kv.set(next.matchByGame(gameId), matchId);
    await kv.set(next.gameByMatch(matchId), gameId);
  }
  for (const gameId of plan.gameResolveIds) {
    await copyIfExists(legacy.resolve(gameId), next.resolve(gameId));
  }

  await kv.del(next.leaderboard);
  for (const address of plan.leaderboardAddresses) {
    const score = await kv.zscore(legacy.leaderboard, address).catch(() => null);
    if (score !== null && score !== undefined) {
      await kv.zadd(next.leaderboard, { score: Number(score), member: address });
    }
    await copyIfExists(legacy.stats(address), next.stats(address));
  }

  await writeListPreservingOrder(next.reportList, plan.reportIds);
  for (const id of plan.reportIds) {
    await copyIfExists(legacy.report(id), next.report(id));
  }

  await writeListPreservingOrder(next.studioProjects, plan.studioProjects);

  log("copy complete");
}

async function verify(plan) {
  log("Verifying v1 KV namespace");
  const failures = [];

  const v1GameIds = await readList(next.gamesList);
  if (JSON.stringify(plan.gameIds) !== JSON.stringify(v1GameIds)) failures.push("games list mismatch");

  for (const gameId of plan.gameIds) {
    if (!(await compareValue(legacy.game(gameId), next.game(gameId)))) failures.push(`game mismatch ${gameId}`);
  }
  for (const { gameId, matchId } of plan.gameMatchIds) {
    const [byGame, byMatch] = await Promise.all([
      kv.get(next.matchByGame(gameId)),
      kv.get(next.gameByMatch(matchId)),
    ]);
    if (String(byGame) !== String(matchId)) failures.push(`matchByGame mismatch ${gameId}`);
    if (String(byMatch) !== String(gameId)) failures.push(`gameByMatch mismatch ${matchId}`);
  }
  for (const gameId of plan.gameResolveIds) {
    if (!(await compareValue(legacy.resolve(gameId), next.resolve(gameId)))) failures.push(`resolve mismatch ${gameId}`);
  }

  const v1Leaderboard = await kv.zrange(next.leaderboard, 0, -1).catch(() => []);
  if (JSON.stringify(plan.leaderboardAddresses) !== JSON.stringify(v1Leaderboard)) failures.push("leaderboard address mismatch");
  for (const address of plan.leaderboardAddresses) {
    if (!(await compareValue(legacy.stats(address), next.stats(address)))) failures.push(`stats mismatch ${address}`);
  }

  const v1ReportIds = await readList(next.reportList);
  if (JSON.stringify(plan.reportIds) !== JSON.stringify(v1ReportIds)) failures.push("reports list mismatch");
  for (const id of plan.reportIds) {
    if (!(await compareValue(legacy.report(id), next.report(id)))) failures.push(`report mismatch ${id}`);
  }

  const v1StudioProjects = await readList(next.studioProjects);
  if (JSON.stringify(plan.studioProjects) !== JSON.stringify(v1StudioProjects)) failures.push("studio list mismatch");

  if (failures.length) {
    console.error("verify failed");
    for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
    if (failures.length > 50) console.error(`...and ${failures.length - 50} more`);
    process.exitCode = 1;
    return;
  }

  log("verify complete", "all copied keys match");
}

async function cleanup(plan) {
  if (!confirmedDelete) {
    console.error("cleanup refused: set CONFIRM_DELETE_LEGACY_KV=DELETE_LEGACY_KV to delete legacy keys");
    process.exitCode = 1;
    return;
  }

  await verify(plan);
  if (process.exitCode) return;

  log("Deleting legacy KV keys");
  await kv.del(legacy.gamesList);
  for (const gameId of plan.gameIds) {
    await kv.del(legacy.game(gameId));
    await kv.del(legacy.matchByGame(gameId));
    await kv.del(legacy.resolve(gameId));
  }
  for (const { matchId } of plan.gameMatchIds) {
    await kv.del(legacy.gameByMatch(matchId));
  }

  await kv.del(legacy.leaderboard);
  for (const address of plan.leaderboardAddresses) {
    await kv.del(legacy.stats(address));
  }

  await kv.del(legacy.reportList);
  for (const id of plan.reportIds) {
    await kv.del(legacy.report(id));
  }

  await kv.del(legacy.studioProjects);
  log("cleanup complete");
}

try {
  loadEnvFile(process.env.KV_ENV_FILE || readArgValue("--env-file"));

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required.");
  }

  ({ kv } = await import("@vercel/kv"));

  const plan = await collectPlan();
  if (mode === "copy") await copy(plan);
  else if (mode === "verify") await verify(plan);
  else if (mode === "cleanup") await cleanup(plan);
  else await dryRun(plan);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
