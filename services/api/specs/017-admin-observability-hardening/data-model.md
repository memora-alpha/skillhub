# Data Model: Admin Operations and API Hardening

This feature adds read models and permissions, not a second authoritative business
store. Existing module entities remain authoritative.

## DashboardSnapshot

`asOf`, `from`, `to`, `timezone`, plus independently discriminated `users`, `learning`,
`finance`, `work`, and `topSkills` sections. Available sections contain values; unavailable
sections contain a stable safe error code.

## DashboardBucket

`localDate`, `fromUtc`, `toUtc`, `partial`, and metric values. Buckets are zero-filled
only after the source query succeeds.

## AdminWorkItem

`id`, `kind`, `displayCode`, `title`, `severity`, `reason`, `status`, `waitingOn`,
`assignee`, `receivedAt`, `waitingSince`, `ageSeconds`, `related`, `impact`, `version`,
`openTarget`, and source-confirmed `allowedActions`. This is a transient projection.

## AdminLearningPathProjection

Path identity and lifecycle, participant public cards, locked plan/version directions,
session schedule/status, aggregate attendance, settlement, reports and termination
summaries. It contains links/identifiers only for separately authorized detail endpoints.

## RateLimitPolicy

Configuration-owned endpoint group, window, quota and key dimensions. Counter state is
ephemeral and contains HMAC/opaque keys rather than raw PII.
