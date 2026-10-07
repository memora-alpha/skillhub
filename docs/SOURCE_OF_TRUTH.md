# SkillHub source of truth

## Current business source

- `SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` is the current business source of truth.
- `SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx` and `SRS_SkillHub_V1.3.docx` are retained for historical comparison only.
- Data model documents remain useful for structure, but when they conflict with SRS 1.6, record the conflict and do not invent a rule.

## Important SRS 1.6 updates

- SkillHub supports `TWO_WAY`, `ONE_WAY` and digital materials.
- `TWO_WAY` requires exactly two opposing `LearningPlan` records: A teaches B and B teaches A. Each plan is created by the teacher for that direction and confirmed by the learner.
- `ONE_WAY` uses one `LearningPlan`; the learner holds negotiated Credit and the teacher receives 96% after completion.
- Schedule proposals are attached to a `LearningPlan` and require both users to confirm the same version.
- Session duration is 60 to 180 minutes.
- Reschedule cutoff is 60 minutes before `startAt`; if both users do not confirm in time, the old schedule remains effective.
- Session completion requires confirmation from both users and does not settle Credit per session.
- Final settlement happens once per agreement after all required sessions complete and no dispute blocks settlement.
- `TWO_WAY` returns 96% of each user's held Credit to that same user and keeps 4% as platform fee.
- `ONE_WAY` transfers 96% of negotiated Credit from the learner's held Credit to the teacher and keeps 4% as platform fee.
- Credit conversion is 1.000 VND = 1 Credit.
- Withdrawal and cash-out are out of scope.
- OTP wrong attempt number 5 soft-bans the email for 24 hours.
- Reputation starts at 50 and is controlled by backend policy.
- Digital materials can be free or paid by Credit; material reports do not require `learningPathId` or `sessionId`.

## Workspace documentation split

- Root `docs/` holds product-wide requirements and shared data model references.
- `services/api` holds backend architecture, specs and implementation guidance.
- `apps/mobile` holds mobile architecture, mobile rule summaries, API assumptions and implementation specs.
