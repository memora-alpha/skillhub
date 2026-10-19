# Redis OTP amendment — 2026-10-08

> Recovery now requires a separate [OTP verification and reset grant](password-recovery.md). Only registration continues to use its existing direct verification flow. The earlier combined reset descriptions are superseded.

The user requested the Memora registration flow and explicitly rejected PostgreSQL OTP challenge tables. This amendment supersedes the original PostgreSQL proof, issue-window and email-outbox design in spec 002.

## Reference and public contract

Reviewed Memora's current `RegisterUseCase`, `AccountEmailVerificationService`, `RedisEmailVerificationTokenStore` and `VerifyEmailUseCase`. Adopt Redis proof storage, BullMQ delivery and consumption after the account transaction. The later user instruction overrides Memora account ordering: SkillHub stages registration in Redis and creates the account only after successful OTP verification. Memora uses a 24-hour link token; SkillHub retains its existing six-digit OTP, 300-second registration lifetime, endpoints, DTOs and neutral 202 response. No frontend changes are needed.

## Ownership and ordering

- PostgreSQL owns accounts, roles, sessions and audit. Runtime Prisma has no OtpChallenge or OtpIssueWindow model. IdentityEmailDelivery remains domain metadata but is not used by the auth mail sender.
- Redis owns OTP digests, key IDs, user/security-version bindings, TTL, attempt counts, cooldown and hourly counters. Keys hide normalized addresses with HMAC. No plaintext OTP is cached.
- Registration creates no PostgreSQL user, profile, grant or session. Redis stores an AES-GCM encrypted draft alongside the OTP digest: reserved account UUID, full name, Argon2id password hash, timezone/locale and the accepted terms version/time. No plaintext password is stored or put in a queue. Draft and code share the same five-minute TTL.
- Repeated signup and resend preserve the original draft while it is valid. A Redis compare-and-set prevents a stale resend from restoring an expired/consumed draft or replacing a newer one. Resend refreshes the proof/draft TTL subject to existing cooldown/hourly limits. After expiry, resend is neutral and creates nothing; the user must submit registration again.
- Successful REGISTER verification acquires the Redis proof lease and a PostgreSQL email advisory lock, creates the User/USER assignment, activates it and appends audit in one transaction. The committed account is ACTIVE and verified. A rollback leaves no User and releases the proof for retry.
- Existing email addresses remain neutral during registration. Verification never overwrites an unrelated existing account. A committed create whose Redis cleanup failed can be retried with the same reserved UUID without another User or audit event. Legacy pending-account proofs without an encrypted draft cannot create or activate accounts; existing users are unaffected by the OTP-table cleanup.
- Queue jobs contain an ID and authenticated ciphertext, never plaintext address or OTP. The worker rejects expired, replaced, consumed and exhausted proofs. BullMQ performs bounded exponential retries; Redis delivery markers deduplicate successful sends. External acceptance immediately before a crash can still duplicate an email.
- Verification reserves the proof with a 60-second Redis lease, runs the existing PostgreSQL transaction (15-second maximum), then deletes the proof after commit. A failed transaction releases its reservation without consuming the code. Concurrent claim attempts fail. After process death the reservation expires; a retry must recheck account status/securityVersion inside the locked transaction, preventing a committed reset from being repeated.
- Resend is limited to 60 seconds and five issues per UTC hour. Five wrong attempts across purposes/challenges softban that normalized address for 24 hours. All counters and claims use Lua operations. Redis loss invalidates pending OTPs; users must request another code.

## Approved design exception and recovery

Constitution principle 8 previously used a PostgreSQL email outbox for crash-safe delivery. The user's explicit 2026-10-08 request to use Memora's flow replaces that feature-specific design: Redis draft storage and BullMQ enqueue are not atomic. Registration now stages only Redis data before enqueue. If enqueue fails, the draft may remain but no account exists; retry/resend recovers without replacing staged credentials and may require waiting for the 60-second cooldown. Account creation happens later, after proof validation, and proof cleanup follows its PostgreSQL commit. This is not a claim of distributed exactly-once delivery.

Password-change notifications are also enqueued after the password transaction commits. Queue failure cannot roll back the password update; the client may need to log in with the new password after an uncertain response.

## Deployment

SMTP implicitly defaults to TLS on port 465 when SMTP_SECURE is blank. Explicit true/false still wins. A display-name-only SMTP_FROM uses the configured SMTP_USER mailbox; a missing usable mailbox fails startup.

Historical migrations are unchanged. For development, `20261008000000_redis_otp` directly drops the obsolete OTP tables and delivery payload columns. Old OTP records and payloads are discarded; no archive schema or copy is created. This simplification follows the user instruction on 2026-10-08. It does not delete accounts or automatically run against the configured application database. Stop old workers and clear obsolete test jobs/proofs when resetting the dev environment; old ID-only jobs do not have the new encrypted envelope.

The inspected application database has no OTP tables and no seeded roles. It also lacks some foundation audit columns. These are separate deployment gates: do not blindly replay historical migrations against that partially provisioned v3 database. Seed the USER/STAFF/ADMIN roles and reconcile foundation schema on a reviewed migration before expecting the full real-account journey to pass.

## Validation

See validation.md for checks run against this amendment. Integration uses a disposable PostgreSQL schema and actual Redis/BullMQ, with a controlled mailer; it must assert no operational OTP tables exist. No production schema migration is implied by passing these checks.
