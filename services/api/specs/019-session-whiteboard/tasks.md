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
- [ ] T011 PO answers Q1–Q3 in [spec.md](spec.md); adjust D3 if the editable window changes

## Out of scope (separate specs)

- Recording (LiveKit Egress, retention policy, legal hold): blocked on an SRS amendment.
- Web/mobile UI, DataChannel protocol, canvas video track.
