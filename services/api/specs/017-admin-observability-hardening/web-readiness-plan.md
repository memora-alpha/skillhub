# Web API Readiness Implementation Plan

**Goal:** Complete the backend contracts identified in the web integration checklist.
**Architecture:** Preserve module-owned readers and PostgreSQL audit history. Add filters before database pagination, reuse live authorization, and keep all changes in `services/api`.
**Tech Stack:** NestJS 11, TypeScript, Prisma/PostgreSQL, Node test runner.
**Spec:** User's six-row web readiness checklist; SRS V1.6; existing specs 002, 003, 008, 011, 016 and 017.

## Global constraints

- Keep existing lifecycle, publication lock, entitlement and privacy rules.
- Do not modify frontend, mobile, deployed data, or applied migrations.
- Do not commit or push. Work in the supplied clean `fix/admin-moderation` checkout.
- The user explicitly approved adding contact blocking on 2026-11-18; reject detected contact details before persistence.

## Tasks

- [x] Work items: reproduce source cap/filter and equal timestamp cursor failures; push filters and full cursor boundaries into owner readers; verify both directions and cross-kind ties.
- [x] Identity: expose sorted effective `permissions` from the same live resolver used by guards, including GRANT/DENY; verify response and Swagger.
- [x] Materials: add `q`, `ownerId` and time filters to catalog and private lists before pagination, bind cursors to filters, preserve visibility; add authorized moderation history through an exported audit reader.
- [x] Audit: add ADMIN-only `audit:read`, seed grant, `GET /api/v1/admin/audit-logs`, actor/action/target/time filters and descending timestamp/UUID cursor pages. Internal target reader is available only through module-owned services.
- [x] Chat: resolve conditional policy with user; if required, reject before receipt, message or outbox persistence with `CONTACT_INFORMATION_NOT_ALLOWED`.
- [x] Verify focused failing/passing regressions, lint, types and build; publish exact FE contract and rollout notes with available runtime evidence.

## Review focus

- More than 101 rows share a timestamp or precede a rare filter match.
- Cursor reuse after filter/viewer changes must fail rather than silently omit rows.
- DENY overrides role/default/participation grants; no client token claim determines permission.
- Personal material search must retain buyer/owner visibility and immutable snapshots.
- Audit access must reject STAFF/USER, missing grants and malformed input before reading data.

## Constitution check

Scope/stores: Pass (backend/PostgreSQL only). Module ownership: Pass (owner readers and audit export). Transactions: read-only additions, existing moderation writes unchanged. Security: ADMIN plus explicit grant; existing live identity guard. Contracts: additive fields/routes, UTC and compound cursors. Verification: Pass; see web-readiness-validation.md for actual checks and runtime evidence. No constitutional exception.
