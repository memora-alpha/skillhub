# Learning Request FE Extension Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; dispatch independent tag work under superpowers:dispatching-parallel-agents. Track completed steps below.

**Goal:** Expose the user-approved request card fields and selectable canonical tags to FE.

**Architecture:** Extend existing Learning Request DTO/policy/use-cases/repository/projections. Sharing Skills remains authoritative for offered skills; Skills owns the read-only Tag API. PostgreSQL schema changes are additive.

**Tech Stack:** NestJS 11, Prisma 7.8, PostgreSQL, class-validator, Zod, native Intl, node:test; no new dependency.

**Spec:** [fe-extension-design.md](fe-extension-design.md). User explicitly approved the proposed contract and requested immediate implementation; execute here on the existing feature/learning-request branch. No additional approval, commit or push.

## Global constraints

API only; existing clients remain valid. At most 10 distinct offered IDs and 5 weekly slots. Optional text 20–3000 code points. Hourly credit decimal string with 2 fractional digits, BIGINT hundredths internally. Preserve auth, state/version/moderation and existing tag selection semantics. Keep docs beside the existing LR spec as repository guidance requires.

## Tasks

- [x] 1. Add failing FE-extension policy/use-case/Swagger tests and observe failure on missing fields; baseline existing LR suite. New tests live in test/learning-requests/fe-extension.test.mjs.
- [x] 2. Extend request-text.policy.ts with preparation/normalization and DTOs with explicitly documented weekly inputs. Reuse shared validateTimeZone and text sanitizer. Extend moderation input to teachingOverview. Verify boundary tests.
- [x] 3. Add runtime-generator fields/association, additive migration and persistence mapping; generate Prisma client. Extend Sharing Skills service/repository with request-offering validation and batched public projections. Test foreign-owner/inactive selections and preservation of existing records.
- [x] 4. Wire create/edit/publish validation in existing transactions, content signatures and change detection. Extend owner/reviewer/public/feed/recommended projections and Swagger responses. Test replacement/null clearing, content moderation/version, skill visibility and all projections.
- [x] 5. Implement independent ACTIVE Tag lookup inside Skills module with query DTO/response/controller/service/repository, cursor binding and tests; no schema, root tooling or app module changes.
- [x] 6. Run focused + full LR/Skills checks, lint, typecheck/build, schema validation, disposable database integration and fresh code review. Update contracts/quickstart/validation and plan checklist with observed results.

## Review focus

Foreign owner's skill IDs; hidden/archived skills after publication; overlapping/DST weekly schedules; numeric or oversized credit; legacy PATCH preserving new content while changing existing fields. Tests must verify these boundaries and public projections must not leak profile-only metadata.

## Execution ledger

- Ruling: reuse the existing clean feature branch and current dependencies; creating another checkout would add setup work without isolation benefit for this focused scope.
- Ruling: expose current skill metadata rather than a copied profile description. The request-specific overview is versioned/moderated; live profile edits follow existing Sharing Skill visibility rules.

- Completed: baseline 93/93; final Learning Request 102/102; real feature HTTP/PostgreSQL 16/16; existing Skills 26/26; lint/typecheck/build/schema checks passed. No application migration deploy, commit or push.
- Review fixes: normalize offered UUID case before distinct checks; reject fixed UTC offsets for weekly IANA timezone. Both have observed RED to GREEN regression tests.
- Review note: catalog-lock concurrency coverage remains limited; existing transaction runner retries deadlocks atomically. No additional concurrency abstraction was introduced.
