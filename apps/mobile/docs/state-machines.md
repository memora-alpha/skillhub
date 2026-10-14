# Mobile state machines

Mobile renders backend state. It must not invent transitions or silently infer final business outcomes.

## App connection

This is client infrastructure state, independent of the business states below.

```text
AVAILABLE -> OFFLINE (device reports no connection)
AVAILABLE -> UNREACHABLE (HTTP transport cannot reach the API)
OFFLINE or UNREACHABLE -> RETRYING (manual retry, device reconnect or app resume)
RETRYING -> AVAILABLE (API responds and read queries finish without a new network failure)
RETRYING -> OFFLINE or UNREACHABLE (connection still fails)
```

OFFLINE, UNREACHABLE and RETRYING use the same app-wide full-screen view. Reconnect
does not replay mutations. HTTP business errors, cancelled requests and stale
session responses do not change this state. See [connection behavior](network-state.md).

## Account

```text
PENDING_VERIFICATION -> ACTIVE
ACTIVE -> SUSPENDED
ACTIVE -> LOCKED
ACTIVE -> DEACTIVATED
```

## Skill Verification

Keep three independent server states; do not use a single linear state machine.

| Resource            | Current API states                                   |
| ------------------- | ---------------------------------------------------- |
| Sharing Skill badge | UNVERIFIED, PENDING, VERIFIED, REJECTED              |
| Verification batch  | PENDING -> APPROVED or REJECTED                      |
| Evidence approval   | PENDING -> APPROVED or REJECTED; APPROVED -> REVOKED |

Current aggregate policy prioritizes remaining APPROVED evidence, then PENDING
requests, then REJECTED when a submitted batch exists, otherwise UNVERIFIED. Thus a skill
may stay VERIFIED while a new batch is PENDING or after one file is revoked.
Mobile reads the aggregate returned by the server; it must not calculate it from
one page of history. REVOKED is not a Sharing Skill badge value.

Approved evidence does not expire automatically. New batches/files need separate
review; a malware scan does not approve expertise.

Evidence storage is separate from approval:

```text
UPLOADING -> QUARANTINED -> SCANNING -> READY
SCANNING -> QUARANTINED (server retry)
SCANNING -> REJECTED or SCAN_FAILED
```

UPLOAD_FAILED, CLEANUP_PENDING and DELETED also exist in storage. Only READY
permits submission; unexpected states are unavailable for submission. Avatar
CLEAN is a different contract. Follow [spec 004](../specs/004-skills-management/spec.md)
for polling, retry and session boundaries.

## Learning Request

```text
DRAFT -> PENDING_MODERATION
DRAFT -> OPEN
PENDING_MODERATION -> OPEN
PENDING_MODERATION -> REJECTED
OPEN -> NEGOTIATING
NEGOTIATING -> MATCHED
OPEN -> CANCELLED
OPEN -> EXPIRED
```

Rejected requests must display the backend reason.

## Proposal or Invitation

```text
PENDING -> ACCEPTED
PENDING -> REJECTED
PENDING -> WITHDRAWN
PENDING -> EXPIRED
```

`ACCEPTED` opens conversation or negotiation only. It does not hold Credit.

## Learning Path

```text
DRAFT -> PROPOSED
PROPOSED -> PARTIALLY_CONFIRMED
PARTIALLY_CONFIRMED -> CONFIRMED
CONFIRMED -> SCHEDULED
SCHEDULED -> ACTIVE
ACTIVE -> COMPLETED
ACTIVE -> DISPUTED
ACTIVE -> CANCELLED
```

`CONFIRMED` requires the correct LearningPlan count for the exchange type, current-version learner confirmations and agreement confirmation from both users.

## Schedule Proposal

```text
DRAFT -> PROPOSED
PROPOSED -> PARTIALLY_CONFIRMED
PARTIALLY_CONFIRMED -> LOCKED
PROPOSED -> NEEDS_REVISION
PROPOSED -> CANCELLED
PROPOSED -> EXPIRED
```

`LOCKED` requires both users to confirm the same version plus backend validation and Credit hold.

## Session

```text
CONFIRMED -> READY
READY -> ONGOING
ONGOING -> AWAITING_CONFIRMATION
AWAITING_CONFIRMATION -> COMPLETED
AWAITING_CONFIRMATION -> DISPUTED
CONFIRMED -> CANCELLED
```

`COMPLETED` requires both users to confirm. It does not settle Credit per session.

## Credit Transaction

Use backend transaction status and type as returned. Mobile must not rewrite ledger history or compute final settlement.

Important transaction concepts:

- `TOP_UP`
- `HOLD`
- `RELEASE`
- `PATH_RETURN`
- `TEACHING_PAYMENT`
- `TEACHING_EARNING`
- `PLATFORM_FEE`
- `REFUND`
- `PENALTY`
- `ADJUSTMENT`

## Report and Dispute

```text
OPEN -> UNDER_REVIEW
UNDER_REVIEW -> RESOLVED
UNDER_REVIEW -> REJECTED
UNDER_REVIEW -> ESCALATED
```

A dispute can block final settlement until backend resolves it.
