# Password recovery: verify OTP before setting a password

User-requested amendment, 2026-10-08. This supersedes the combined OTP/password reset contract. Backend scope only; no change to signup, password-change-in-app, or database schema. The existing uncommitted development schema alignment is separate work.

## Plan and contract

1. Keep `POST /api/v1/auth/password/forgot` with `{email}` and neutral 202. Resend calls the same endpoint. Existing OTP cooldown, hourly cap, email softban and request throttles remain.
2. Add `POST /api/v1/auth/password/verify-otp` with `{email,otpCode}`. Correct, unexpired RESET_PASSWORD OTP and an eligible account produce 200 with `data:{resetToken,expiresAt}` and `Cache-Control:no-store`. Incorrect proofs return 400 `OTP_INVALID_OR_EXPIRED`. No password, securityVersion, session or audit mutation happens here.
3. Change `POST /api/v1/auth/password/reset` to `{email,resetToken,newPassword,confirmNewPassword}`. Reject legacy `otpCode`, missing tokens and invalid password confirmation at validation. Missing/invalid/expired/replayed tokens return 400 `RESET_TOKEN_INVALID_OR_EXPIRED`. Success remains bodiless 204, with no automatic login or account unlock.
4. The client advances to its new-password screen only after verify-otp succeeds, retains the token in memory, then calls reset. Token expiry/loss requires starting again at forgot. This is an incompatible change to the unreleased v1 contract explicitly requested by the user; no legacy combined-flow fallback is retained.

## Ownership, ordering and recovery

- Auth owns Redis OTP and reset grants. PostgreSQL remains authoritative for the account, password, securityVersion, sessions and audit. No OTP/reset-grant tables are added.
- Reset tokens are opaque 32-byte cryptographically random credentials. Redis stores only a purpose-bound HMAC digest, key ID, reserved proof UUID, user ID, securityVersion and expiry. Keys hide normalized email. Neither token nor OTP goes into logs, audit, URLs or mail. Both request and response bodies are already redacted by the shared logger.
- OTP verification reserves its proof for 60 seconds, rechecks eligibility/binding under the PostgreSQL user lock, then atomically exchanges that exact Redis proof/lease for a reset grant using Lua. Only one concurrent verification receives a token. The OTP is consumed and stale email jobs become inactive. The grant lifetime reuses `IDENTITY_RESET_SECONDS`, beginning at verification; the response supplies its UTC expiry.
- A successfully issued replacement RESET_PASSWORD OTP atomically removes the previous grant. Suppressed requests (cooldown/hourly limits) do not revoke grants. Issuance is blocked while a reset grant is claimed for a password transaction.
- Reset claims the grant for 60 seconds and rechecks email/user/securityVersion/eligible status under the user lock. Password/securityVersion update, all-session revocation and PASSWORD_RESET audit commit in one PostgreSQL transaction. Only afterward is the grant deleted. Rollback releases it for retry; a committed change invalidates it through securityVersion even if Redis cleanup fails. Invalid random reset tokens do not increment the six-digit OTP failure counter; shared request throttles still apply.
- Lost verify responses cannot be used to recover a plaintext token from Redis; request another OTP subject to cooldown. PostgreSQL and Redis are not a distributed transaction. Stale grants fail the final account check. Post-commit cleanup/email enqueue failures retain the previously documented uncertain-response behavior; the password may already be changed.

## Constitution Check

- Principles 1/2/7: Pass by design: existing auth use cases/ports/Redis adapter and owner services; no cross-owner direct database writes or frontend changes.
- Principles 3/4/5: Pass by design: atomic password/session/audit transaction, Argon2id, random digest-only one-use tokens, DTOs and Swagger contract, redacted bodies and no-store response.
- Principle 8: Existing approved Redis/BullMQ exception in redis-otp.md remains; no new delivery guarantee. Redis exchange is atomic; account revalidation prevents cross-store stale-proof use.
- Principle 6: Pass: build, typecheck, API ESLint, 12 policy/provider/regression tests and 23 real PostgreSQL/Redis/BullMQ integration entries passed. Evidence is recorded in validation.md. The HTTP checks include the new recovery endpoints; no extra real-mailbox recovery run is claimed.

## Acceptance checks

Verify-only must preserve password/securityVersion and usable sessions. Reject wrong OTP, bypassing verification, cross-email token use, expired/replaced/replayed tokens and changed account bindings. Concurrent OTP verification grants once; concurrent resets commit once. Audit rollback preserves the grant/password/sessions. HTTP tests cover all three recovery endpoints, no-store token response, legacy body rejection, 204 body and login with the resulting password.
