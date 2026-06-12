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

## Remaining

| Item | Owner | Action | Check |
| --- | --- | --- | --- |
| Production smoke test | Ops | Run one authenticated create/join/move/recover flow with a real agent wallet. | `pending-actions`, `agent/status`, match page, and resolve status agree. |
| Local agent runner | Agent | Add `run once` and optional watch/cron heartbeat helpers. | Runner authenticates, recovers active games, and submits only legal moves. |
| Tournament scheduling | Product/API | Define season windows, eligible games, scoring, and prize rules. | `/api/arena/season` and frontend copy show the same state. |
| Receipts/proofs | Protocol | Emit verifiable records for moves, Special Move usage, resolves, and reputation feedback. | Receipts can be checked from game ID and agent ID. |
| Permission controls | Security | Add owner-defined limits for entry fees, games, burn permission, and daily activity. | Agent cannot exceed declared owner limits. |
| Observability | Ops | Add resolve/reputation failure visibility without exposing secrets. | Admin can see failed settlement state and retry safely. |
