# Arena Next Steps

This file tracks follow-up work after the route/service refactor and prompt-first agent onboarding cleanup.

## Completed

| Item | Owner | Action | Check |
| --- | --- | --- | --- |
| Route/service split | API | Move Arena game action logic out of the route and into a service layer. | `monad-mogs-api` build passes. |
| Auth/security cleanup | API | Centralize JSON parse, admin secret, agent session, and rate-limit responses. | Auth-only and admin endpoints fail closed. |
| Prompt-first onboarding | Web/API | Remove form-based registration UI as the primary path; keep ERC-8004 and ERC-8217 requirements. | Agents tab and prompt docs point to the official prompt/skill flow. |
| Edge-case coverage | QA | Add API checks for auth/admin fail-closed behavior and Arena docs consistency. | `monad-mogs-web test:api` passes. |
| Docs sync | Docs | Keep Markdown docs, prompts, `llms.txt`, web copy, and tests aligned when behavior changes. | No stale external reference names in docs or UI copy. |
| Observability/Admin Repair v1 | Ops/API | Add read-only Arena Health admin action and dashboard tab for failed resolve, failed reputation feedback, linked match mismatch, orphaned match, and expired match visibility. | `arena-health` requires `x-admin-secret` and returns sanitized issue records. |
| Local agent runner v1 | Agent/API | Add `run once` and `watch` script helper for heartbeat orchestration without private key management. | Dry-run sample proposes a legal move without mutating state. |
| Permission controls v1 | Security/API | Add local runner permission profile evaluator for allowed games, max entry fee, daily limit, prize games, and burn permission. | Runner refuses disallowed joins/burn suggestions locally. |
| Receipts/proofs v1 | Protocol/API | Add finished-game receipt endpoint with deterministic `resultHash`. | Active hidden state and session data are not included. |
| Tournament/season metadata v1 | Product/API/Web | Add scoring, prize status, and event readiness fields to `/api/arena/season` and Arena tab copy. | Frontend season block reads the same API source. |
| Prompt/doc sync v1 | Docs/API/Web | Align auth payload docs, challenge TTL guidance, existing-agent binding path, Higher or Lower join flow, and Special Move field naming. | Root docs, prompts, web copy, and API tests describe the same behavior. |
| KV TTL refresh v1 | API | Refresh linked match and player recovery TTLs when active games are persisted. | Normal long-running games keep recovery lookups during active play. |
| Recovery hardening v1 | API | Enforce one active offchain game per wallet on join, add explicit degraded/conflict recovery responses, and reuse `agent-binding` discovery in auth/status flows. | `pending-actions`, `agent/status`, and `view=my` stay deterministic and owner-vs-delegated auth is explicit. |

## Remaining

| Item | Owner | Action | Check |
| --- | --- | --- | --- |
| Production smoke test | Ops | Run one authenticated create/join/move/recover flow with a real agent wallet. | `pending-actions`, `agent/status`, match page, and resolve status agree. |
| Hosted runner | Agent/Ops | Decide where persistent runners live and how sessions are refreshed without storing private keys server-side. | Hosted flow never receives owner or agent private keys. |
| Mutating repair workflow | Ops/API | Add explicit retry/cancel helper UX for issues surfaced by Arena Health. | Safe waiting-seat repair for legacy recovery conflicts is live; broader mutating repair helpers still require explicit admin confirmation. |
| Formal tournament scheduling | Product/API | Define actual season windows, eligibility cutoff, prize rules, and leaderboard snapshots. | `/api/arena/season` changes from practice to event state only when operations are ready. |
| Delegated wallet parity v2 | Agent/API/Contracts | Add true delegated `agentWallet` support only when ERC-8217 binding and Arena auth can be proven without relying on the ERC-8004 owner wallet. | Delegated agents can authenticate and bind without owner-side exceptions or hidden caveats. |
| Onchain permission profiles | Security | Evaluate whether critical permissions should move from local config to signed or onchain authorization. | Agent authority is verifiable without trusting only local files. |
| Expanded receipt consumers | Protocol | Feed receipts into tournament scoring, agent history, and reputation audits. | Scores can be recomputed from public receipts. |
