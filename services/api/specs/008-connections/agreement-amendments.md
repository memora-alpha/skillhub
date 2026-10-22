# Pre-lock LearningPath amendments

## Behavior

These rules apply only while the LearningPath is editable before finalize. Once
finalized, schedule changes use the bilateral reschedule flow; cancellation
remains a separate flow.

- Saving identical agreement terms or an identical LearningPlan creates no
  version and preserves all confirmations and schedules.
- Changing a LearningPlan creates only a new plan version. The learner confirms
  that version. The agreement version and confirmations, exchange type, Credit,
  and other direction's plan remain current.
- A revised plan with the same session count carries schedule times forward and
  preserves their confirmations. Changing the session count carries times for
  retained session numbers forward and marks the schedule for revision and
  bilateral confirmation.
- Changing agreement terms creates a new agreement version and requires both
  participants to confirm those terms. Current plans and schedules that remain
  valid for the selected exchange type carry forward with their confirmations.
- `PATCH /api/v1/schedule-proposals/{scheduleId}` revises all pre-lock schedule
  items for the plan. The plan teacher may propose it; both participants confirm
  the new schedule version. Identical schedule items do not create a version.
- Editing is rejected after finalize. Use the existing session reschedule or
  cancellation flow for a locked LearningPath.

## Revision requirements

The client supplies `expectedVersion` for the current schedule proposal and a
complete `items` array for the current plan version. The service validates
session count, duration, future start times, non-overlap, current agreement and
live participant permissions in one transaction. A changed schedule version
starts without either participant's confirmation; previous schedule and plan
versions remain immutable.
