# Mobile state machines

Mobile renders backend state. It must not invent transitions or silently infer final business outcomes.

## Account

```text
PENDING_VERIFICATION -> ACTIVE
ACTIVE -> SUSPENDED
ACTIVE -> LOCKED
ACTIVE -> DEACTIVATED
```

## Skill Verification

```text
UNVERIFIED -> PENDING
PENDING -> VERIFIED
PENDING -> REJECTED
VERIFIED -> REVOKED
```

`VERIFIED` evidence does not expire automatically.

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
