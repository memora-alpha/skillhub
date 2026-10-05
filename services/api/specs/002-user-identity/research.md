# Identity research and design decisions

Date: 2026-10-03. Inputs: actual SRS sections 18.2–18.7/18.25, constitution1.2.0, foundation source/plan, primary documentation below. Research agent performed read-only security review as required by speckit-plan Phase0. Decisions are proposed feature design; SRS product parameters take precedence over generic recommendations.

## Passwords and OTP

**Decision**: Argon2id encoded salted password hashes per constitution; benchmark cost before operational sizing. SRS password composition/8–64 limits remain unchanged. Six-digit OTP has low entropy: use HMAC verifier binding challenge ID/purpose/code with key outside DB, constant-time compare, expiry and atomic attempt/single-use controls.
**Rationale**: Database disclosure should not permit cheap enumeration of OTP without verifier key. Keyed OTP verifier is a design inference, not a direct OWASP prescription.
**Alternatives**: Plaintext forbidden; unkeyed fast OTP hash insufficient against small keyspace; password-only slow hashing does not remove OTP entropy limit.
**Sources**: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OTP handling/storage](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html#one-time-password-otp-handling-and-storage).

## Refresh rotation and revocation

**Decision**: Random opaque refresh tokens/digests; PostgreSQL login family and consumed generations; atomic consume/successor, strict replay revokes family and commits before401. No grace window; client serializes refresh and reauthenticates after duplicate/lost-response revoke. JWT sid live-check makes logout/reset/lock effective for subsequent authorization.
**Rationale**: Replay detection needs retained linkage; JWT signature alone cannot establish current session/status.
**Alternatives**: Static refresh lacks replay control; stateless JWT permits stale access; grace/idempotent refresh adds unrequested policy/secret handling.
**Sources**: [RFC9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14), [RFC8725 JWT practices](https://www.rfc-editor.org/rfc/rfc8725.html).

## Authorization and throttling

**Decision**: Explicit trusted JWT type/algorithm/issuer/audience and live grants/ownership. Admin actions require named permission; Staff administrative grants empty until approved. Redis-backed storage across replicas for email/IP/purpose trackers; PostgreSQL challenge counters remain authoritative. Generic unknown-email responses and dummy password verification; required throttle failure denies auth safely.
**Rationale**: Permissions can change before JWT expires; local counters can be bypassed across processes.
**Alternatives**: Role claims alone stale; broad Staff inheritance conflicts with SRS; foundation per-process throttle insufficient.
**Sources**: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Nest rate limiting](https://docs.nestjs.com/security/rate-limiting), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Email outbox and temporary secret

**Decision**: Challenge/verifier and encrypted temporary email payload commit together in PostgreSQL; BullMQ gets ID only. Separate authenticated-encryption key/key IDs; leases/retry/reconciliation, purpose/generation/expiry checks and terminal secret erasure. Provider idempotency where supported; no exactly-once email promise.
**Rationale**: Hash-only storage cannot reconstruct code for delivery after crash. Protected recoverable payload reconciles reliable outbox with SRS no plaintext OTP. This encryption pattern is a design inference from constitution/outbox/crypto guidance.
**Alternatives**: Sending inside DB transaction holds locks and cannot roll back email; after-commit memory-only send loses intent on crash; plaintext queue/outbox violates privacy.
**Sources**: [AWS Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html), [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html).

## Profiles, avatars and privileged roles

**Decision**: Single profile authority, strict public allowlist, plain-text bio, scanned/quarantined S3 image lifecycle; metadata owner is users. Admin bootstrap via audited operator command, STAFF grants require fresh one-use proof; online ADMIN granting deferred. Required production config for terms/timezone/initial reputation rather than invented policy.
**Rationale**: SRS18.7 requires real MIME/5MB/scan and private email exclusion; SRS18.25 distinguishes Staff and stronger Admin grants. Existing stages defer reputation/skills/financial ownership.
**Alternatives**: Arbitrary URL/avatar key assignment bypasses ownership/scan; copying email/status into public DTO risks leakage; hardcoded Admin seed is unacceptable.
**Source evidence**: Local SRS18.7/18.25 and constitution principles4/5/7; no provider was selected by research.

Technical unknowns resolved as architecture/ports/config above. Product/provider release decisions remain explicitly recorded in spec; research does not claim their approval or live integration.
