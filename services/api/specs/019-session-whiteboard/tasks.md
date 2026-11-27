# Tasks: Session Whiteboard

## Phase 1 — Backend persistence

- [x] T001 Add `prisma/session-whiteboard-support.prisma` and extend `scripts/generate-runtime-schema.mjs` with back-relations
- [x] T002 Regenerate schema/client; add migration `20261125000000_session_whiteboard` with CHECK constraints
- [x] T003 Domain policy: scene validation (schema, unique ids, 2 MiB UTF-8, 20k elements) and the join-window read-only rule
- [x] T004 `SessionWhiteboardService` read/save with optimistic locking and a P2002 → conflict mapping
- [x] T005 Controller + DTOs, register in `LearningSessionsModule`
- [x] T006 Permission `session-whiteboard:update:participant` + USER grant (update access test)
- [x] T007 Route-scoped 2 MiB JSON parser in `main.ts`; declare `express`
- [x] T008 Exception filter allowlist for `currentRevision` / `reason`
- [x] T009 Unit tests `test/learning-sessions/whiteboard.test.mjs`
- [ ] T010 DB integration test against PostgreSQL: migration applies, concurrent first saves → one wins, CHECK constraints (needs `test:learning-sessions:integration` env)
- [x] T012 P1 edit window: config key `whiteboard.editWindow` (teacher preparation, post-session grace), per-role access, frozen statuses, `editableFrom`/`editableUntil`
- [ ] T011 PO approves P1–P4 in [spec.md](spec.md); adjust `whiteboard.editWindow` values if needed
- [x] T013 P3 retention: config key `whiteboard.retentionDays` (default 30, min 8), `purgeExpired` paging, hourly `SessionWhiteboardRetentionWorker`, open-report hold
- [x] T013a Spec 021 D10: per-board `retention_days` snapshot raised on save; worker keeps a board `max(snapshot, config)` days
- [x] T014 P2 `GET /sessions/:id/whiteboard/staff-review?caseId=`: handler of an open case only, audited as `REPORT_EVIDENCE_READ`
- [x] T015 P4: no moderation in the first release (documented)
- [x] T017 Freeze the board while an open report targets or relates to the Session (`SESSION_UNDER_REPORT`); add release seed request `session-whiteboard-20261125`
- [ ] T016 Integration check on PostgreSQL for `purgeExpired` (relation filter + `deleteMany`)

## Out of scope (separate specs)

- Recording (LiveKit Egress, retention policy, legal hold): blocked on an SRS amendment.
- Web/mobile UI, DataChannel protocol, canvas video track.
