# Implementation Plan: Session Whiteboard

## Layout — `src/modules/learning-sessions`

```
domain/whiteboard.policy.ts                         # scene schema/size check, read-only rule (join window)
application/services/session-whiteboard.service.ts  # read, save with optimistic lock
presentation/http/session-whiteboard.controller.ts  # GET/PUT /sessions/:sessionId/whiteboard
presentation/http/session-whiteboard.dto.ts
```

## Data

`prisma/session-whiteboard-support.prisma` is appended by `scripts/generate-runtime-schema.mjs`,
which also adds the `Session.whiteboard` and `User.sessionWhiteboardUpdates` back-relations.
Migration `20261125000000_session_whiteboard` creates `session_whiteboards` with:

- unique `session_id`, FK to `sessions` and `users` (RESTRICT);
- CHECK `revision >= 0`, `scene_bytes` within 0–2 MiB, `scene_data` is a JSON object.

## Write path

One Serializable transaction (`TransactionRunner`, which retries on serialization failures):

1. read the Session and check membership;
2. take database time and `livekit.joinWindow`; reject when outside the window;
3. no row: `expectedRevision` must be 0 → create revision 1. A concurrent first insert
   raises P2002, which is mapped outside the transaction to a revision conflict;
4. row exists: `updateMany where revision = expectedRevision`, increment, else conflict.

The Session and Path are not locked. The save stores only collaboration state, and the
window check uses database time, so at most one save can land at the instant the window closes.

## Shared changes

- `main.ts`: a route-scoped `express.json` parser (2 MiB + 4 KiB) is registered before the global 100 kB parser.
- `http-exception.filter.ts`: allowlist `currentRevision` and `reason` for the two whiteboard 409s.
- `permission.catalog.ts` + USER grants: `session-whiteboard:update:participant`.
  Release seed request `session-whiteboard-20261125` (`identity` + `configuration`) runs on the next Docker deploy.
  Manual rollout: `pnpm --filter api identity:seed` and `pnpm --filter api db:seed-configuration`
  (`db:seed-configuration:built` inside a prebuilt container, whose `/app` is read-only).
- `package.json`: declare `express@5.2.1`; the lockfile only adds the specifier.

## Consumers

`apps/web` must allow the two routes in the user BFF policy. Its proxy body limit must
also accept 2 MiB for this route. Mobile only needs `GET` for a read-only view.
