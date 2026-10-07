# Mobile domain rules from SRS 1.6

## Source priority

Use `../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` as the current business source. This file summarizes mobile-facing rules so implementation work can move quickly, but it does not replace the SRS or backend API contract.

## Identity and profile

- OTP wrong attempt number 5 soft-bans the email for 24 hours.
- User can be both learner and teacher depending on the agreement.
- Public profile may show display name, avatar, bio, reputation, selected badge and public sharing skills.
- Public profile must not show login email, phone, payment data, private evidence files or private material URLs.

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
