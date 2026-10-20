# SkillHub Web

Next.js Admin/Staff portals. Install from the repository root with `pnpm install`; configure `SKILLHUB_API_URL` in the ignored local `.env` using `.env.example`. Run `pnpm dev:web` from the root.

## Notifications

Both `/staff/notifications` and `/admin/notifications` use the authenticated recipient inbox. The header and screen share one session-scoped store. Refresh/read/live updates retain previously loaded pages, request fresh cursors from the first page, and deduplicate IDs. Transient read errors retain visible content; 401/403/404 clear it. Signing out unmounts the store and aborts its HTTP/stream work.

`GET /api/{staff|admin}/events` authenticates the portal role through `/me`, then streams `/api/v1/events` using the portal's HttpOnly access cookie. Bearer tokens never enter client state or URLs. The proxy disables caching/buffering, forwards `Last-Event-ID`, streams with backpressure, and cancels upstream on disconnect. Session renewal shares the existing single-flight refresh with REST requests.

One stream handles the signed per-user feed. Notification references trigger authorized inbox hydration before acknowledging the cursor. Reconnect replays the last processed cursor; expired/invalid resume cursors start a fresh stream and snapshot. Reconnect backs off for up to six consecutive failures, stops on permission denial, and pauses in hidden tabs. Manual refresh stays available when live updates fail. The unread dot and filter describe only loaded notifications; the API has no total unread, server unread filter, bulk-read or preference endpoints. Admin/Staff screens do not expose mobile-only deep links or derive navigation from arbitrary payload URLs.

### Required API rollout

The API uses one role per account. Migration `20261020000000_staff_notification_access` adds only `notification:read:self`, `notification:update:self`, and `event:read:self` to STAFF/ADMIN; the identity seed also preserves them. Apply with the normal reviewed migration release process. These grants do not provide participant/chat/proposal permissions or access to anyone else's inbox. This branch does not apply migrations to an application database.

## Checks

- `pnpm --filter web test`: inbox pagination/read/failure/concurrency, SSE replay/hydration and proxy/session isolation tests. The `tsx` dev dependency reuses the version already in the workspace lockfile; no new runtime dependency is added.
- `pnpm --filter web lint`
- `pnpm --filter web check-types`, then `pnpm --filter web build` sequentially: both write `.next`.

Related mobile integration and its verification are documented in [the mobile contract](../mobile/docs/contracts/notifications.md). Unit/fixture checks do not establish deployed migration, production proxy/SSE delivery or native-device acceptance.

### Verification — 2026-10-20

- Web: 11 tests pass; lint, typecheck and production build pass on Node 24.19.0. API: 23 focused access/inbox/repository/delivery/feed tests pass, plus lint, typecheck and build. Prisma generation used a compile-only loopback placeholder URL; no database connection or migration was performed.
- Mobile: 337 tests pass on Node 22.19.0; mobile lint/typecheck/structure and web export passed in the preceding integration pass. The web-only tsx importer reuses the existing locked version and changes no mobile runtime versions.
- Visual acceptance is not verified. Automatic tool approval rejected starting the isolated Next.js preview against the loopback fixture with `blocked by policy`; the temporary fixture was stopped and removed. Production API, migration, reverse-proxy SSE and native-device checks remain rollout work.
