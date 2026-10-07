# Validation: mobile foundation

## Checks

- Documentation exists under `apps/mobile`.
- Root source-of-truth document points to SRS 1.6.
- Mobile guidance says not to edit backend for mobile tasks unless explicitly requested.
- File size limits are documented.
- SRS 1.6 changes are reflected: `TWO_WAY`, `ONE_WAY`, LearningPlan, materials, final settlement, OTP softban, no withdrawal and 60 minute reschedule cutoff.

## Manual review notes

- No Expo code has been generated.
- No dependency installation is required for this foundation-only change.
- No backend file should be changed by this foundation task.
