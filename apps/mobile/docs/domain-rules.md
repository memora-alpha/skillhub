# Mobile domain rules from SRS 1.6

## Source priority

Use `../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` as the current business source. This file summarizes mobile-facing rules so implementation work can move quickly, but it does not replace the SRS or backend API contract.

## Identity and profile

- OTP wrong attempt number 5 soft-bans the email for 24 hours.
- User can be both learner and teacher depending on the agreement.
- Public profile may show display name, avatar, bio, reputation, selected badge and public sharing skills.
- Public profile must not show login email, phone, payment data, private evidence files or private material URLs.
- Public skill detail may show the skill name, self-declared level, description,
  experience years and verification badge for a currently public skill. Evidence,
  certificates, review history/reasons and owner actions stay private, including
  when the owner previews their public profile.

## Sharing skills and verification

- Sharing Skill references an ACTIVE Skill Catalog ID; users do not create free-text
  catalog entries. Only one nonarchived Sharing Skill per user/catalog ID is allowed.
- Level is self-declared and selected from the chosen skill's ACTIVE level catalog
  (`GET /skills/:skillId/levels`). Create/level changes send `levelId`; display
  uses `skillLevel.name`, including custom codes such as B2/N3. Existing inactive
  selections remain valid for edits that omit levelId. Legacy records with null
  metadata display their old code/label. Description
  is 20–1500 characters; experienceYears is optional, 0–60 with one decimal place.
  The current API sends the decimal as a string or null.
- Create/edit forms show the selected catalog level's description when provided.
  Changing skill clears the previous level selection. Missing/failed/empty level
  lookup blocks new selection until it succeeds; input drafts remain available.
  Catalog descriptions do not grant verification or imply certificate equivalence.
- Hiding a skill preserves the owner's record and history. Archive is soft deletion;
  changing catalog ID requires another Sharing Skill. Current API blocks archive
  while a verification batch is PENDING. The backend now exposes a dedicated
  restore command; mobile spec 004 does not expose that action.
- Per the user's 2026-10-11 UI decision, soft deletion is labeled "Xóa kỹ năng".
  Deleted skills disappear from own/public lists and cannot be opened through
  old mobile detail/edit/verification links. Mobile exposes no archived-record
  toggle; the active skill's public/private controls remain available.
- Editing level/description does not let mobile decide or reset verification.
  SRS SK-002 leaves material-change policy to the system; current service preserves
  the server badge. Do not invent that policy in the client.
- Evidence submission accepts 1–5 new files: PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP.
  Upload and malware scan do not approve expertise; only authorized Staff/Admin
  decisions do. New files require their own review.
- Evidence size follows server configuration. Current upload/attachment code also
  caps each file at 10,000,000 bytes; configuration may lower that limit.
- READY is the evidence storage state required before submitting a verification
  batch. This differs from avatar CLEAN. A 202 upload response is only receipt.
- Saving a new skill with evidence creates the skill first, then returns to
  My Skills with the confirmed DTO. A session-owned task compresses/uploads/scans
  and submits the verification request after navigation. If evidence fails,
  the card shows an incomplete transfer and explicit Retry, plus an error toast.
  Keep the evidence draft in the session so the owner can reopen the skill and
  explicitly retry. A failed/unconfirmed skill save stays on the form.
  Mobile uploads all selected files before waiting for their scans, reads scan
  status together and reports the current upload/check/submit stage. Only READY
  files are submitted. Confirmed save/submit navigates immediately; refreshing
  reads runs in the background and does not turn success into a failed save.
  Own cards show a small sending spinner, Chờ duyệt only after confirmed PENDING,
  or Gửi chưa hoàn tất with Retry. Existing VERIFIED badges remain separate.
  Navigation does not cancel sending; app background pauses it for explicit retry.
  Closing the app loses session-only drafts/jobs; no durable background promise.
- Evidence images over 2 MB may be re-encoded as JPEG quality 0.9 without crop
  or resize, only retaining a smaller valid output. Small images/documents and
  files already uploaded are preserved. Owner can choose the original before
  upload; compression failure preserves it. READY/cap/privacy remain authoritative.
  Confirmed creates appear newest first in the current session. Historical
  creation ordering needs the missing owner timestamp/sort contract (spec GAP-09).
- Slow QUARANTINED/SCANNING files retain their uploaded IDs and an informational
  waiting state after bounded polling. Check again reads those IDs before any
  submission; waiting for scan never grants a pending-approval or verified badge.
- Skill badge, verification batch and evidence approval are different states;
  REVOKED belongs to evidence, not the four-value Sharing Skill badge.
- Only one verification batch may be PENDING for a skill. Mobile hides resubmit
  until a decision; its Pending filter also includes VERIFIED skills with a new
  PENDING latestVerification, preserving the existing verified badge.
- Approved evidence does not expire automatically. Display rejection/revocation
  reasons from owner-only history/detail, never in public profile.
- Learned skills after Learning Path completion are separate from VERIFIED skills.
  They remain outside spec 004.

Implementation scope and unresolved contract differences are recorded in
[spec 004](../specs/004-skills-management/spec.md). Implementation connects the
existing API; runtime and platform evidence is recorded separately in its
[validation](../specs/004-skills-management/validation.md).

## Learning Request and Proposal

- Publishing a Learning Request runs moderation.
- Flagged requests go to `PENDING_MODERATION`.
- Rejected requests must show the backend reason to the owner.
- Accepting a Proposal opens chat or negotiation; it does not create sessions and does not hold Credit.

## Learning Path and LearningPlan

- `LearningPath` is the agreement container.
- `TWO_WAY` requires exactly two opposing `LearningPlan` records: A teaches B and B teaches A.
- `ONE_WAY` requires one `LearningPlan` from teacher to learner.
- Each plan is created by the teacher for that direction.
- The learner confirms the current version of the plan created by the teacher.
- If the learner requests changes, the users negotiate in chat; only the teacher or creator updates the plan.
- Updating plan content increases version and resets learner confirmation.
- A total agreement confirmation does not replace per-plan learner confirmation.

## Scheduling and sessions

- Schedules are attached to `learningPlanId`.
- The teacher or creator of the plan proposes that plan's schedule.
- Schedule item count must match the plan's session count.
- A and B must confirm the same schedule version.
- `TWO_WAY` needs confirmed schedules for both plans before final validation and hold.
- `ONE_WAY` needs the single plan schedule confirmed before final validation and hold.
- Each session is 60 to 180 minutes.
- Reschedule requires both users to confirm at least 60 minutes before `startAt`; otherwise the old schedule remains effective.
- Session completion requires both users to confirm after the session.
- Completed sessions update progress but do not settle Credit.

## Credit and payment

- 1.000 VND equals 1 Credit.
- Payment redirect from the client is not proof of payment success.
- Backend verified payment is the source for top-up.
- Do not show withdrawal or cash-out.
- `TWO_WAY` requires at least 20 Credit per user for the whole agreement.
- `TWO_WAY` holds Credit for both users.
- `ONE_WAY` uses negotiated Credit greater than zero and only the learner holds Credit.
- Final settlement happens once after all required sessions complete and no dispute blocks settlement.
- `TWO_WAY` returns 96% held Credit to each original holder and records 4% platform fee.
- `ONE_WAY` pays 96% negotiated Credit to the teacher and records 4% platform fee.
- Client must not calculate final ledger amounts; refetch backend state after mutations.

## Chat, LiveKit and upload

- Chat text is not a business confirmation.
- System events should be rendered as typed events.
- Chat attachment limit is 15 MB unless backend contract changes it.
- LiveKit secret never goes to the client.
- Backend issues short-lived LiveKit tokens only for session participants.
- Leaving or joining a room is not proof of session completion.

## Review, reputation and report

- Review opens only after Learning Path completion.
- Rating is an integer from 1 to 5.
- Each user reviews the other user at most once per Learning Path.
- Reputation starts at 50 and stays within 0 to 100.
- Mobile displays reputation state from backend and does not calculate penalties.
- Reports for learning issues attach to the related `learningPathId` and `sessionId`.
- Material or material-order reports may exist without `learningPathId` or `sessionId`.
- Disputes can hold final settlement.

## Digital materials

- Materials can be `FREE` or `PAID`.
- Paid material purchase uses available Credit outside the Learning Path flow.
- Material file storage keys and private URLs must not be exposed as public links.
- If price or version changes before purchase confirmation, mobile must require confirmation of the new snapshot.
