#!/usr/bin/env node
import fs from "node:fs/promises";

const DEFAULT_API_BASE = "https://api.monadmogs.xyz";
const DEFAULT_STATE_PATH = "mogs-arena-state.json";
const DEFAULT_PERMISSIONS_PATH = "mogs-agent-permissions.json";
const ALL_GAMES = ["coin-flip", "rock-paper-scissors", "dice-duel", "higher-lower"];

function argValue(args, name, fallback = undefined) {
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasArg(args, name) {
  return args.includes(name);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizePermissions(profile = {}) {
  const allowedGames = Array.isArray(profile.allowedGames)
    ? profile.allowedGames.filter((game) => ALL_GAMES.includes(game))
    : ALL_GAMES;
  return {
    allowedGames: allowedGames.length ? [...new Set(allowedGames)] : ALL_GAMES,
    maxEntryFeeWei: profile.maxEntryFeeWei || null,
    maxGamesPerDay: Number.isFinite(profile.maxGamesPerDay) ? Math.max(0, Math.floor(profile.maxGamesPerDay)) : null,
    allowPrizeGames: profile.allowPrizeGames === true,
    allowBurnSpecialMove: profile.allowBurnSpecialMove === true,
  };
}

function evaluatePermissions(profile, input) {
  const permissions = normalizePermissions(profile);
  const reasons = [];
  if (!permissions.allowedGames.includes(input.gameType)) {
    reasons.push(`Game type ${input.gameType} is not allowed.`);
  }
  if (input.isPrizeGame && !permissions.allowPrizeGames) {
    reasons.push("Prize games are not allowed.");
  }
  if (
    permissions.maxEntryFeeWei !== null &&
    input.entryFeeWei !== null &&
    input.entryFeeWei !== undefined &&
    BigInt(input.entryFeeWei) > BigInt(permissions.maxEntryFeeWei)
  ) {
    reasons.push("Entry fee exceeds maxEntryFeeWei.");
  }
  if (
    permissions.maxGamesPerDay !== null &&
    typeof input.gamesPlayedToday === "number" &&
    input.gamesPlayedToday >= permissions.maxGamesPerDay
  ) {
    reasons.push("Daily game limit reached.");
  }
  if (input.wantsBurnSpecialMove && !permissions.allowBurnSpecialMove) {
    reasons.push("Burn Special Move is not allowed.");
  }
  return { ok: reasons.length === 0, reasons, profile: permissions };
}

function chooseMove(pending) {
  const moves = pending?.validMoves || pending?.pending?.validMoves || [];
  const currentNumber = pending?.currentNumber || pending?.pending?.currentNumber;
  if (moves.includes("higher") && moves.includes("lower") && typeof currentNumber === "number") {
    return currentNumber >= 50 ? "lower" : "higher";
  }
  return moves[0] || null;
}

async function apiRequest(apiBase, path, token, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

async function runOnce(config) {
  const state = await readJson(config.statePath, {});
  const permissions = await readJson(config.permissionsPath, {});
  const token = config.token || process.env.ARENA_RUNNER_SESSION_TOKEN || state.sessionToken;

  if (config.sample) {
    const pending = { action: "submit_move", gameId: "sample-game", validMoves: ["higher", "lower"], currentNumber: 72 };
    const plannedMove = chooseMove(pending);
    return {
      mode: config.dryRun ? "dry-run" : "sample",
      nextAction: pending.action,
      plannedMove,
      permission: evaluatePermissions(permissions, {
        gameType: "higher-lower",
        entryFeeWei: "0",
        isPrizeGame: false,
        wantsBurnSpecialMove: false,
      }),
    };
  }

  if (!token) {
    return {
      nextAction: "authenticate",
      reason: "No session token found in --token, ARENA_RUNNER_SESSION_TOKEN, or state file.",
      instructions: "Run arena auth challenge/verify with the agent wallet, then store the returned token in the state file or env.",
    };
  }

  const pending = await apiRequest(config.apiBase, "/api/arena/pending-actions", token);
  if (!pending.ok) {
    return { nextAction: "inspect_auth_or_api", status: pending.status, response: pending.json };
  }

  const action = pending.json.pending?.action || pending.json.action || "idle";
  if (action === "submit_move") {
    const plannedMove = chooseMove(pending.json.pending || pending.json);
    const result = {
      nextAction: "submit_move",
      gameId: pending.json.pending?.gameId || pending.json.gameId,
      plannedMove,
      dryRun: config.dryRun,
    };
    if (config.dryRun || !plannedMove || !result.gameId) return result;

    const submitted = await apiRequest(config.apiBase, "/api/arena/games", token, {
      method: "POST",
      body: JSON.stringify({ action: "move", gameId: result.gameId, move: plannedMove }),
    });
    await writeJson(config.statePath, { ...state, sessionToken: token, lastRunAt: new Date().toISOString(), lastResult: submitted.json });
    return { ...result, status: submitted.status, response: submitted.json };
  }

  if (action === "check_open_games") {
    const open = await apiRequest(config.apiBase, "/api/arena?view=open", token);
    const candidate = open.json.games?.[0];
    const permission = candidate
      ? evaluatePermissions(permissions, {
          gameType: candidate.type,
          entryFeeWei: candidate.entryFee || "0",
          isPrizeGame: Boolean(candidate.matchId),
          wantsBurnSpecialMove: false,
        })
      : null;
    return { nextAction: candidate ? "review_join_candidate" : "wait", dryRun: config.dryRun, candidate, permission };
  }

  return { nextAction: action, dryRun: config.dryRun, pending: pending.json.pending || pending.json };
}

async function main() {
  const args = process.argv.slice(2);
  const config = {
    apiBase: argValue(args, "--api", process.env.ARENA_RUNNER_API_BASE || DEFAULT_API_BASE).replace(/\/$/, ""),
    statePath: argValue(args, "--state", process.env.ARENA_RUNNER_STATE || DEFAULT_STATE_PATH),
    permissionsPath: argValue(args, "--permissions", process.env.ARENA_RUNNER_PERMISSIONS || DEFAULT_PERMISSIONS_PATH),
    token: argValue(args, "--token"),
    dryRun: hasArg(args, "--dry-run"),
    sample: hasArg(args, "--sample"),
    watch: hasArg(args, "--watch"),
    intervalMs: Number(argValue(args, "--interval", "60000")),
  };

  do {
    const result = await runOnce(config);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!config.watch) break;
    await new Promise((resolve) => setTimeout(resolve, config.intervalMs));
  } while (true);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
