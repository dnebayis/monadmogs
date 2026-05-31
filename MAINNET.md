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

## MogsArena Upgradeable (Mainnet)

| Field | Value |
|---|---|
| Proxy | `0x328a9D6060Ce914e3ba707fBDa453cb8dB39f5C9` |
| Implementation | `0x9654D5Fda3D104b83540224B71F2b03aD1854836` |
| Chain | Monad Mainnet (chain ID 143) |
| Admin | `0x5dB181E8b9b042468cF324e57AB6c8f9D284575c` |
| Admin Fee | 5% of entry fees |
| Upgrade Pattern | UUPS / ERC1967Proxy |
| Verification | Sourcify exact match on MonadVision endpoint |
| Tests | 71 passing against the current source |

### Features
- MON + NFT prize support (ERC-721 escrow)
- ERC20 prize support for `$MOGS` (`0x9cF1538f92341A311a922D411DE8C471DCEA7777`)
- NFT + `$MOGS` combined prize route
- Upgradeable implementation for future collab/game/prize extensions
- Reentrancy guard, pause/unpause
- 2-hour match timeout with public expireMatch
- Security hardening is implemented in source: full matches reset timeout on second join before a new implementation upgrade
- Draw resolution with full refunds
- Per-player active match limit
- gameHash links onchain match to offchain game ID
- pendingWithdrawals fallback for failed transfers
- Linked admin API creates offchain game + onchain match + `gameId -> matchId` link in one request
- Arena skill, protocol introspection, and heartbeat prompts support dev.fun-style agent operation

### Latest Upgrade
- Implementation upgraded to `0x9654D5Fda3D104b83540224B71F2b03aD1854836`.
- Deploy tx: `0xdaaa590d3b96698ffeb4af76f5f43d3e059597382945007c3e09933f7f024757`
- Upgrade tx: `0x0e53bfe6270dc792d316d763b8a72606a0877d7a74ad11d4f2fd943c63662de8`
- Sourcify verification: exact match, job `1513c7c1-50e1-45b9-9436-fd1c126f0238`.
- Proxy implementation slot confirmed as `0x9654D5Fda3D104b83540224B71F2b03aD1854836`.

### Rarity Advantage Design
- Exact rarity snapshot generated from all 5,000 onchain `tokenURI()` responses.
- Public routes: `/api/v0/mogs/{id}/rarity` and `/api/v0/rarity`.
- Exact rarity is live now. Gameplay modifiers are pending and should not be submitted until the arena protocol marks `raritySystem.active: true`.
- Rare tiers can later unlock capped tactical modifiers, not guaranteed wins.
- Common and uncommon Mogs can later access one fixed modifier through `$MOGS` burn.
- One active modifier per Mog per match. Burn amount never scales power.
- First rollout target: dice-duel reroll and higher-lower hint.

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
