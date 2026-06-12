# Monad Mogs — Mainnet Deployment Record

Deployment is complete. All steps below have been executed. This file is a historical record.

## Network

| Field | Value |
|---|---|
| Chain | Monad mainnet |
| Chain ID | `143` |
| RPC | `https://rpc.monad.xyz` |
| Explorer | `https://monadscan.com` |

## Contract

| Field | Value |
|---|---|
| Address | `0x1414f3BAF22404C42fD656af4aFAab4934045137` |
| Deployer | `0xf818A22f404337F86a1155937fB119a5b9438fD6` |
| MAX_SUPPLY | `5000` |
| WALLET_LIMIT | `5` |
| totalSupply | `5000` |
| mintOpen | `false` (closed after sell-out) |
| metadataFrozen | `true` |
| owner | renounced (`address(0)`) |

## Key Transactions

| Event | Tx Hash |
|---|---|
| Mint opened | `0x6d3d17743e43c4d58f7efb296ae2339f1fe181eeeb2afcc78662bb263330d638` |
| Smoke mint | `0xf89ae389367f11b8eb2ffd64b3477c443610c7cd88c86978446216cbe36b86d0` |

## ERC-8004 Registries (Monad mainnet)

| Registry | Address |
|---|---|
| Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## MogsAgentBindings — ERC-8217 (Monad mainnet)

| Field | Value |
|---|---|
| Contract | `0xd79CE369eB5E2Dbf54F697e3215cf99E91691D65` |
| Spec | ERC-8217 Agent NFT Identity Binding |
| Chain | Monad mainnet (chain ID 143) |
| NFT_CONTRACT | `0x1414f3BAF22404C42fD656af4aFAab4934045137` |
| IDENTITY_REGISTRY | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Deploy tx | see broadcast/DeployMogsAgentBindings.s.sol/143/run-latest.json |

### How to bind

Call `bind(uint256 agentId, uint256 mogId)` from the agent wallet.
Caller must own both the ERC-8004 agent NFT (agentId) and the Mog NFT (mogId).
Binding is immutable once written. One Mog, one agent.

Already registered on ERC-8004? No re-registration needed — just call `bind()` once.
`agentId` and `mogId` are in `mogs-agent-registration.json`.

### Resolver endpoints

```
GET /api/agents/binding?agentId={id}   — which Mog is this agent bound to?
GET /api/agents/by-mog?mogId={id}      — which agent is bound to this Mog?
```

## MogsArena Upgradeable (Mainnet)

| Field | Value |
|---|---|
| Proxy | `0x328a9D6060Ce914e3ba707fBDa453cb8dB39f5C9` |
| Implementation | `0x178eFf00CfC86Beed3f98b999542ac37A864D7B2` |
| Chain | Monad Mainnet (chain ID 143) |
| Admin | `0x5dB181E8b9b042468cF324e57AB6c8f9D284575c` |
| Admin Fee | 5% of entry fees |
| Upgrade Pattern | UUPS / ERC1967Proxy |
| Verification | Sourcify exact match on MonadVision endpoint |
| Tests | 22 upgradeable arena tests passing against the current source |

### Features
- MON + NFT prize support (ERC-721 escrow)
- ERC20 prize support for `$MOGS` (`0x9cF1538f92341A311a922D411DE8C471DCEA7777`)
- NFT + `$MOGS` combined prize route
- Upgradeable implementation for future collab/game/prize extensions
- Reentrancy guard, pause/unpause
- 2-hour match timeout with public expireMatch
- Security hardening is implemented in source: full matches reset timeout on second join
- Draw resolution with full refunds
- Per-player active match limit (one active onchain match per wallet)
- Waiting linked match exit through `leaveMatch(matchId)` plus API `leave`
- gameHash links onchain match to offchain game ID
- pendingWithdrawals fallback for failed transfers
- Linked admin API creates offchain game + onchain match + `gameId -> matchId` link in one request
- Arena skill, protocol introspection, and heartbeat prompts support prompt-first agent operation
- `uint256[50] private __gap` storage reserve for future upgrade safety

### Latest Upgrade
- Implementation upgraded to `0x178eFf00CfC86Beed3f98b999542ac37A864D7B2`.
- Deploy tx: `0x71c41f58d55637942b7a0ceebfd2b0d234a6657df54cc9833093eb97961f6f98`
- Upgrade tx: `0x87844b40617db31e5edd1ba2d4730b714033386543efb01973c109225bcfe673`
- Proxy implementation slot confirmed as `0x178eFf00CfC86Beed3f98b999542ac37A864D7B2`.
- Change: added `uint256[50] private __gap` storage reserve for future upgrade safety. No functional changes.

### Special Move Design
- Exact rarity snapshot generated from all 5,000 onchain `tokenURI()` responses.
- Public routes: `/api/v0/mogs/{id}/rarity` and `/api/v0/rarity`.
- Special Move is active for Dice Duel and Higher or Lower when the arena protocol marks `raritySystem.active: true`.
- Legendary Mogs get 2 free Special Moves per match.
- Epic and Rare Mogs get 1 free Special Move per match.
- Common and Uncommon Mogs can access 1 Special Move through a fixed `1,000 $MOGS` burn.
- Burn amount never scales power, and burn access does not stack with rarity access.
- Special Move is tactical help only and never guarantees a win.

## MogsArena v3 (Testnet)

| Field | Value |
|---|---|
| Contract | `0xAfEfFA4cC52d8e3358b4C075573F3Ed284E036CB` |
| Chain | Monad Testnet (chain ID 10143) |

## Final State

- **5,000 / 5,000** Mogs minted. Sold out.
- Metadata frozen onchain. All SVG renders are immutable.
- Contract ownership renounced. No admin keys exist.
- Art and metadata source: `tokenURI()` on the contract.
- Collection is cc0: remix, build, credit Monad Mogs.
