# Local runtime validation — Connections

**Date:** 2026-10-11. **Branch:** `feat/connections`. **Scope:** API Connections journeys and their owner dependencies. No Docker, commit or push. Mongo setup, PostgreSQL migration/configuration seed and local storage enablement were applied on the user's requests as described below.

## Conclusion

The implemented core HTTP journeys work with migrated PostgreSQL, a Mongo replica set and Redis. The configured local API is running and both health endpoints return 200. Local PostgreSQL has the Connections migration and approved configuration defaults; Mongo uses `rs0` with chat indexes. Chat file upload, asynchronous scan, publication and authorized download passed against R2 bucket `skillhub` and native ClamAV using isolated application fixtures. Approved nonempty Learning Request moderation rules and broader release race/load gates remain pending.

## Latest recheck with running API and live file providers — 2026-10-11

- The actual configured API returns **200** for `/api/health`, `/api/health/ready` and the public skill catalog. Proposal, Conversation, notification, event and Learning Request routes return the expected **401** without authentication.
- `node scripts/check-local-connections-http.mjs --configured-mongo --live-storage` passed **13 grouped HTTP/SSE checks**, including the real Mongo transaction suite (**1 pass, 0 failures, 0 skips**). Authenticated journeys use disposable PostgreSQL/Mongo fixtures, isolated Redis keys and test-only moderation rules; they do not modify public application users or rules.
- The live file journey uploaded one harmless 1x1 PNG through the CHAT HTTP API (**202/QUARANTINED**), waited for the actual outbox/Redis worker to reach **READY/CLEAN**, published the attachment into a message with idempotent retry, obtained a signed download for the other participant and verified identical bytes (**200**). A nonmember received **404**; another participant could not read uploader-only pre-send status. Attachment state changes were observed through SSE.
- Cleanup deleted only the random private object created by the isolated fixture and verified it was absent. The final probe confirms **0 temporary PostgreSQL schemas and 0 temporary Mongo databases**, healthy real stores, 12 applied public migrations and 8 public configuration rows.
- The configured application still has **0 moderation rules**. Learning Request publish requires approved nonempty rules; its empty-rule-set 503 remains a blocker. The successful test-only rule does not approve a production policy.
- This is local core behavior and one harmless file journey, not full API coverage or multi-instance/proxy/load/recovery proof. No Docker, new migration deployment or application configuration changes were performed by this recheck. Earlier findings below are historical snapshots.

## Native ClamAV configuration fix — 2026-10-11

The reported `Can't open/parse ... clamd.conf` error was caused by a missing configuration file. The installed binary is now x64, matching Windows. Created `clamd.conf` and `freshclam.conf` from the installed samples, removed `Example`, selected a shared signature directory and bound clamd to `127.0.0.1:3310`. `clamconf` parsed both files successfully. Freshclam downloaded and validated daily/main/bytecode signatures.

The scanner is running as a native process, not an installed auto-start service. A read-only PING returns **PONG**. `node scripts/check-local-providers.mjs --scan-sample` uses the built API adapter to scan harmless in-memory text and returns **CLEAN**, with ClamAV **1.5.4**. R2 bucket access still returns **HTTP 200**. No S3 object or application database was written by this scan; upload/scan/download end to end remains unverified. Earlier scanner connection failures below are historical snapshots.

## Recheck before API startup and live file journey — 2026-10-11

- The configured-Mongo HTTP/SSE harness passed **12 grouped checks** again; the real Mongo publication/read suite passed **1 test, 0 failures, 0 skips**. This run used disposable PostgreSQL/Mongo fixtures, isolated Redis keys, test-only moderation rules and disabled storage. No Docker was used.
- The broader regression runner passed **188 tests, 0 failures, 0 skips** outside the sandbox. The initial sandbox run had 8 failures in local HTTP/provider tests; rerunning the same built code outside the sandbox resolved those failures without source changes.
- Fresh application probes confirm **12 completed PostgreSQL migrations**, `proposals.version`, all three Connections chat/event tables, **8 configuration rows**, Mongo `rs0` PRIMARY/chat indexes and Redis connectivity. Post-test cleanup left **0 temporary PostgreSQL schemas and 0 temporary Mongo databases**.
- Private storage is enabled; a read-only request to R2 bucket `skillhub` returns **HTTP 200**. Actual upload/scan/download was not exercised.
- The configured API endpoint does not respond and no listener was found on port 3001. ClamAV still returns **`ECONNREFUSED`** and no listener was found on port 3310. The application moderation rule count is **0**; publish rejects an empty rule set with HTTP 503. These remain runtime blockers, despite the successful isolated journeys.

## Applied local fixes — 2026-10-11

The user requested the PostgreSQL migration/configuration seed and storage configuration fixes:

- `pnpm db:validate`, `pnpm db:deploy` and `pnpm db:seed-configuration` completed successfully. The configured local PostgreSQL `public` schema now has 12 completed migrations, including `20261009010000_connections`, the `proposals.version` column and the `chat_publications`, `user_event_streams` and `user_event_deliveries` tables. There are 8 configuration rows; the seed preserves existing operator values.
- The ignored local `.env` now sets `STORAGE_ENABLED=true` and `S3_BUCKET=skillhub`. File/evidence endpoint, region and credentials match the existing avatar R2 settings. Environment validation passed and read-only bucket access returned HTTP 200. No real upload/delete was performed.
- ClamAV still returns `ECONNREFUSED` on the configured local port, so successful upload/scan/download remains unverified. The seeded moderation rule set is intentionally empty; Learning Request publish still requires approved rules. The configured API HTTP endpoint is not running.
- The post-change probe confirms Mongo `rs0` PRIMARY with chat indexes, Redis connectivity, and zero temporary Connections schemas/databases. Earlier findings below are historical snapshots before these fixes.

## API recheck before PostgreSQL/storage fixes — 2026-10-11

On the user's subsequent request, the current built API passed the configured-Mongo HTTP harness again: **12 grouped checks pass**, with the Mongo transaction suite **1 pass / 0 skipped**. The broader API regression runner passed **188 tests / 0 failures / 0 skips**. Those regression tests include controlled provider fixtures, not successful live file delivery. No Docker was used.

The HTTP journeys still use a migrated disposable PostgreSQL schema, test-only nonempty moderation rules, a separate Mongo database on the actual `rs0` service, disabled storage and isolated queue/throttle keys. They prove those core journeys with these dependencies, not the current `public` schema or every provider journey.

Fresh read-only checks against the configured application environment found:

- PostgreSQL `public` still has 11 applied migrations and no Connections migration. Actual generated-Prisma reads fail with `P2022` for `Proposal.version`, and `P2021` for `ChatPublication` / `UserEventStream`; Conversation and Notification ID-only reads succeed.
- `system_configurations` has **0 rows**, so configuration-dependent APIs are not initialized. Seeding defaults is needed; publishing Learning Requests additionally needs approved nonempty moderation rules.
- Mongo remains writable `rs0` PRIMARY with all five named chat indexes. Redis PING succeeds.
- A real read-only `HeadBucket` request to R2 bucket `skillhub` returns **HTTP 200**. This establishes bucket accessibility, not upload/scanning/download success.
- Scanner PING cannot connect: **`ECONNREFUSED`**. File storage remains disabled. Avatar/file processing is not verified end to end with the current scanner.
- The configured development HTTP endpoint still does not respond. The harness starts and closes temporary HTTP servers.

Provider checks are repeatable with `node scripts/check-local-providers.mjs`; the script performs only bucket HEAD and scanner PING, with no upload/delete/email. Application code, `.env`, public schema, migrations and Windows services were not changed during this recheck. Full configured-environment API readiness is **not established**.

Final cleanup probe confirms **0 temporary PostgreSQL schemas and 0 temporary Mongo databases**; Mongo remains PRIMARY. The provider diagnostic passes Node syntax checking and focused ESLint. Documentation/diagnostic formatting and `git diff --check` pass.

## Mongo service update — applied 2026-10-11

After the user's follow-up, the actual Windows `MongoDB` service was converted from standalone to single-member replica set `rs0`. Its config was backed up beside `mongod.cfg` before adding `replication.replSetName: rs0` and restarting via an approved Windows Administrator/UAC operation. Existing dbPath, port 27017 and loopback binding were preserved. `initialize-local-mongo.mjs` initialized the set and verified writable PRIMARY. The ignored `.env` now uses `mongodb://127.0.0.1:27017/skillhub_chat?replicaSet=rs0&directConnection=true`.

`node scripts/migrate-chat.mjs` created the four chat collections in the configured `skillhub_chat` database and all five named indexes: `sender_identity`, `published_sequence`, `published_history`, `participant_read_state`, `pending_bridge`. The three message indexes and both read/bridge indexes were confirmed by a final read-only probe.

`node scripts/check-local-connections-http.mjs --configured-mongo` passed **12 grouped checks** on this actual service, including text send **201 / DELIVERED**, stable retry, conflicting retry 409, history/read, chat SSE, replay and session revocation. Its real Mongo transaction integration suite passed **1 test, 0 failures, 0 skips**. PostgreSQL still used a migrated disposable schema; no public migration was deployed. Mongo HTTP/test fixtures used separate random databases, with **0 temporary Mongo databases and 0 temporary PostgreSQL schemas** after cleanup. The configured service remains running as PRIMARY.

The new setup/diagnostic scripts pass Node/PowerShell syntax checks and focused ESLint, and documentation passes Prettier. Setup follows [MongoDB's standalone conversion procedure](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/). Helpers and repeatable checks are in [quickstart](quickstart.md).

## Configured environment before Mongo conversion: read-only findings

| Dependency  | Observed state                                                                                           | Implication                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL  | Local PostgreSQL 18.4 reachable; 11 migrations applied through `20261008010000_runtime_schema_alignment` | `20261009010000_connections` is pending; `chat_publications`, `user_event_streams` and `user_event_deliveries` are absent |
| MongoDB     | Local service reachable, writable standalone; configured chat database has no collections/indexes        | Transactions required by send/read are unavailable; message send returned HTTP 503 in a live check                        |
| Redis       | Configured Redis responds to PING; actual queues, wakeups and SSE leases used in the harness             | One-instance runtime works; this does not establish multi-instance/proxy/load behavior                                    |
| Storage     | `STORAGE_ENABLED=false`                                                                                  | CHAT upload returns HTTP 503; successful upload/scan/download not verified                                                |
| Moderation  | No `learningRequest.moderationRuleSet` row                                                               | Publish needs an approved nonempty rule set; default empty rules fail closed with HTTP 503                                |
| API process | No response at the configured development HTTP endpoint                                                  | Harness booted its own temporary HTTP servers and closed them afterwards                                                  |

`/api/health/ready` checks database connectivity. It returned 200 in the harness even against standalone Mongo; it does not establish transaction/index/storage capability.

## Executed runtime checks

All checks used installed local database services or an installed native `mongod` process. PostgreSQL fixtures ran the migration history inside randomly named disposable schemas, leaving `public` untouched. The native Mongo replica set used a separate loopback port and temporary data directory. The configured standalone Mongo service was not restarted or reconfigured.

| Check                                                                                         | Result                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real PostgreSQL suite, `node scripts/check-local-connections-stores.mjs`                      | **1 pass, 0 fail, 0 skipped**: competing acceptance, stable replay, unique Conversation, notification create/read triggers and feed dedupe, including retry after feed trimming |
| Real Mongo suite invoked by HTTP harness                                                      | **1 pass, 0 fail, 0 skipped**: hidden drafts, concurrent publication/sequence and monotonic read intent on native replica set                                                   |
| Full AppModule HTTP harness, `node scripts/check-local-connections-http.mjs <path-to-mongod>` | **12 grouped checks pass**, described below                                                                                                                                     |

The HTTP harness uses real Nest controllers, guards, validation, exception handling, password/session/JWT services, PostgreSQL owner repositories, Mongo chat repository and Redis. Overrides select an isolated Prisma schema, isolated BullMQ prefix and temporary operational configuration; no business service is replaced by a mock. Storage remains disabled. The isolated moderation fixture has one valid test-only rule; it does not approve a business rule set for the application.

1. AppModule startup, `/api/health` and `/api/health/ready`.
2. Login for fixture users with actual passwords, grants, sessions and JWTs.
3. Direct proposal create/replay, edit preserving expiry, accept/replay and Conversation get/list; unauthenticated 401, outsider 404, injected sender 400.
4. Proposal and notification create/read events via actual PostgreSQL feed and Redis wakeup; notification read returns 204.
5. Signed `Last-Event-ID` SSE reconnect/replay.
6. Learning Request create/publish/browse through real owner adapters, followed by request-source proposal reject, withdraw and accept; Request becomes `NEGOTIATING` and Conversation references it.
7. Message send against configured standalone Mongo returns 503.
8. File upload with disabled storage returns 503; unknown file status returns 404.
9. Native Mongo replica-set integration suite and explicit chat index migration.
10. SSE closes after real `logout-all`; revoked JWT cannot read Conversation (401).
11. Text send/retry/conflicting retry, sender-only delivery status, history and pagination, read watermark, message/read SSE events; unknown published attachment download returns 404.
12. Acceptance and chat create zero Session/Credit records.

The initially skipped PostgreSQL fixture required corrections to match migrated constraints: reuse the seeded USER role, supply required user defaults, and set `publishedAt` on an OPEN Request with expiry. These were fixture changes, not application source fixes. An initial Learning Request publish attempt exposed empty default moderation rules; after supplying the isolated nonempty test fixture, the complete journey passed.

The added diagnostic scripts and corrected PostgreSQL fixture pass ESLint with zero warnings and Node syntax checks. Documentation/scripts are formatted with Prettier; `git diff --check` passes. Application source was not changed during this runtime verification.

## Cleanup and limits

The harness closed HTTP/SSE connections, removed its disposable schemas, deleted only its isolated Redis queue/throttle keys, and stopped/deleted only its own native Mongo process/data directory. A final read-only probe found **0 temporary Connections schemas**, the same 11 public migrations, unchanged standalone Mongo topology/empty configured chat database, and storage still disabled. Application `.env` and Windows database services were not modified. No OTP/email delivery was requested.

Actual S3/scanner success, recovery during Mongo stepdown, full source/revocation/expiry race matrices, two API instances, proxy flush/backpressure and performance remain unverified. The PostgreSQL suite's eligibility/audit collaborators are fixtures; the HTTP journey checks actual collaborators but is not a complete race matrix. T036 remains open.

## Enable the local application

Mongo setup, PostgreSQL migration/seed and storage enablement are completed locally. Remaining steps are identified below:

1. **Completed locally:** PostgreSQL Connections migration and approved configuration seed.
2. **Completed locally:** native Mongo `rs0`, `MONGODB_URI` and chat indexes. For another environment, use the setup steps in quickstart; the temporary replica set option in the harness is still removed after testing.
3. Configure an approved nonempty moderation rule set through the system-configuration owner before publishing Learning Requests.
4. **Storage enabled locally:** shared R2 bucket `skillhub`. Start/configure ClamAV and verify successful file journeys.
5. Start the API using `pnpm dev` and repeat client journeys against its configured port.

See [quickstart](quickstart.md) for commands and SSE usage. Historical static checks and remaining release gates are in [validation](validation.md).
