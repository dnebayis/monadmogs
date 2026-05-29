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

## MogsArena (Testnet)

| Field | Value |
|---|---|
| Contract | `0xa2c39E325e298653045C43bEB544737D655fbFa5` |
| Chain | Monad Testnet (chain ID 10143) |
| Admin | `0x5dB181E8b9b042468cF324e57AB6c8f9D284575c` |
| Entry Fee | 10 MON |
| Admin Fee | 5% of entry fees |
| Tests | 26 passing |

Mainnet migration pending — contract is identical, will be redeployed when ready.

## Final State

- **5,000 / 5,000** Mogs minted. Sold out.
- Metadata frozen onchain. All SVG renders are immutable.
- Contract ownership renounced. No admin keys exist.
- Art and metadata source: `tokenURI()` on the contract.
- Collection is cc0: remix, build, credit Monad Mogs.
