#!/usr/bin/env node
import fs from "node:fs";
import { kv } from "@vercel/kv";
import { createPublicClient, http, parseAbiItem } from "viem";

const DEFAULT_RPC = "https://rpc.monad.xyz";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CHUNK_SIZE = 100n;

const keys =
  process.env.KV_NAMESPACE === "v1"
    ? {
        list: "agents:v1:awakened:list",
        item: (mogId) => `agents:v1:awakened:${mogId}`,
        count: "agents:v1:awakened:count",
        lastIndexedBlock: "agents:v1:awakened:last-indexed-block",
      }
    : {
        list: "agents:awakened",
        item: (mogId) => `agents:awakened:${mogId}`,
        count: "agents:awakened:count",
        lastIndexedBlock: "agents:awakened:last-indexed-block",
      };

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

function argValue(args, name, fallback = undefined) {
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function requireAddress(value, label) {
  if (!value || value === ZERO_ADDRESS) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function toRecord(log, timestamp) {
  return {
    agentId: log.args.agentId.toString(),
    tokenId: log.args.tokenId.toString(),
    name: `Mog #${log.args.tokenId.toString()}`,
    type: "Mog",
    registeredBy: log.args.registeredBy,
    registeredAt: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : undefined,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber.toString(),
    bindingContract: log.address,
    source: "adapter",
  };
}

async function main() {
  const args = process.argv.slice(2);
  loadEnvFile(argValue(args, "--env"));

  const adapter = requireAddress(
    argValue(args, "--adapter", process.env.NEXT_PUBLIC_MOGS_8004_ADAPTER_ADDRESS),
    "NEXT_PUBLIC_MOGS_8004_ADAPTER_ADDRESS",
  );
  const rpcUrl = argValue(args, "--rpc", process.env.MONAD_RPC_URL || DEFAULT_RPC);
  const fromBlockArg = argValue(args, "--from-block", process.env.MOGS_8004_ADAPTER_DEPLOY_BLOCK);
  const fromBlock = fromBlockArg ? BigInt(fromBlockArg) : BigInt((await kv.get(keys.lastIndexedBlock)) || 0);
  const client = createPublicClient({
    transport: http(rpcUrl),
  });
  const latest = await client.getBlockNumber();
  const event = parseAbiItem(
    "event AgentBound(uint256 indexed agentId,uint8 indexed standard,address indexed tokenContract,uint256 tokenId,address registeredBy)",
  );

  const existing = (await kv.get(keys.list)) || [];
  const byMog = new Map(existing.map((record) => [String(record.tokenId), record]));
  let cursor = fromBlock;

  while (cursor <= latest) {
    const toBlock = cursor + CHUNK_SIZE - 1n > latest ? latest : cursor + CHUNK_SIZE - 1n;
    const logs = await client.getLogs({
      address: adapter,
      event,
      fromBlock: cursor,
      toBlock,
    });
    const blockTimestamps = new Map();
    for (const log of logs) {
      if (!blockTimestamps.has(log.blockNumber)) {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        blockTimestamps.set(log.blockNumber, block.timestamp);
      }
      const record = toRecord(log, blockTimestamps.get(log.blockNumber));
      byMog.set(record.tokenId, record);
      await kv.set(keys.item(record.tokenId), record);
    }
    await kv.set(keys.lastIndexedBlock, toBlock.toString());
    cursor = toBlock + 1n;
  }

  const list = [...byMog.values()].sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  await kv.set(keys.list, list);
  await kv.set(keys.count, list.length);

  process.stdout.write(
    `${JSON.stringify(
      {
        adapter,
        fromBlock: fromBlock.toString(),
        toBlock: latest.toString(),
        count: list.length,
        kvNamespace: process.env.KV_NAMESPACE || "legacy",
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
