# Tasks: Session Recording

## Gates

- [x] G1 Purpose decided: learning review first, evidence second (D1, revised 2026-11-26)
- [x] G2 Decisions D2–D10 approved for implementation (2026-11-26)
- [ ] G3 SRS amendment (before turning `recording.enabled` on in production)
- [ ] G4 Legal review of the consent text against Decree 13/2023 (same)
- [ ] G5 LiveKit Egress quote; set `recording.monthlyAlertMinutes` (same)

## Phase 1 — Foundation

- [x] T001 `prisma/session-recording-support.prisma` + back-relation in `scripts/generate-runtime-schema.mjs`
- [x] T002 Migration `20261126000000_session_recording`: enums, CHECKs, partial unique index for active rows
- [x] T003 Config keys `recording.enabled`, `.kind`, `.retentionDays`, `.overrunMinutes`, `.monthlyAlertMinutes` (+ configuration test)
- [x] T004 Permission `session-recording:manage:participant`, USER grant (+ access test)
- [x] T005 Release seed request in `release-seeds.json`; `RECORDING_STORAGE_*` in `.env.example` and startup validation
- [x] T006 `domain/recording.policy.ts`: transitions, request window (D3), cap, expiry, with unit tests

## Phase 2 — Consent flow

- [x] T007 `LiveKitEgressService`: start room composite (video or audio only) to S3, stop, list, room metadata; provider errors mapped to codes
- [x] T008 `SessionRecordingService`: request, accept, decline, stop with Serializable conditional updates
- [x] T009 Controller + DTOs for request/accept/decline/stop/list; exception filter allowlist
- [x] T010 Tests with a fake Egress client: both-party consent, wrong actor, wrong status, concurrent accept, kill switch, window closed

## Phase 3 — Provider events

- [x] T011 Webhook consumer `livekit.session-recording` for `egress_started` / `egress_ended`, receipt dedupe
- [x] T012 Reconcile worker: stuck `STARTING`/`STOPPING`, window close, cap, unanswered requests, kill switch stops active Egress
- [x] T013 Outbox events + notification handler: requested, failed
- [x] T014 Tests: lost webhook repaired, duplicate webhook ignored, failure notifies both, Session unaffected (D8)

## Phase 4 — Viewing and lifecycle

- [x] T015 Playback: presigned `inline` URL, 5-minute TTL, `READY` and unexpired only
- [x] T016 Participant delete: remove object, mark `DELETED`, notify the other participant
- [x] T017 Retention worker: expire after `retentionDays`, paged like spec 019 P3; monthly minutes alert log
- [x] T018 Tests: playback access, delete idempotency, expiry, report hold on expiry and deletion (D6, D7)

## Phase 4b — Staff review (D10)

- [x] T022 Extract the spec 019 P2 case check (`reportedSessionIds`, hold statuses, handler check) into a shared helper used by the whiteboard and recordings
- [x] T023 `GET …/recordings/:recordingId/staff-review?caseId=`: presigned URL, audited `REPORT_EVIDENCE_READ` (target `SESSION_RECORDING`)
- [x] T024 Tests: handler of an open case only, refused reads write no audit, audit row per URL issued

## Phase 5 — Verification and docs

- [x] T019 PostgreSQL integration test: migration, partial unique index, concurrent requests
- [ ] T020 (needs a LiveKit Cloud test project and bucket; steps in `docs/session-recording-setup.vi.md` §5) Manual run against LiveKit Cloud and a test bucket; record real file sizes per hour
- [x] T025 Spec 021 amendment: plan gate on request and accept, minutes charged at `egress_ended`, per-recording retention snapshot
- [x] T021 Docs: `livekit-sessions.vi.md` (replace "not recorded"), Egress and bucket setup, put-only key policy

## Follow-ups (separate specs)

- Web and mobile: consent dialog, indicator from room metadata, recordings list, player, delete.
- Teacher preference to refuse all recordings.
