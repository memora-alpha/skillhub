# Identity setup and verification

> Current OTP design: [Redis OTP amendment (2026-10-08)](redis-otp.md) supersedes PostgreSQL challenge/counter and email-outbox statements below.

Identity controllers now invoke application use cases directly. Private Prisma
adapters live under each owner's `infrastructure/persistence`; jobs/schedulers
live under `infrastructure/jobs`. Integration fixtures compile the runtime
application provider graph and substitute controlled external resources. The
21 endpoints, deployment schema and required environment values remain the same.

From the repository root, install with `pnpm install`. Work from `services/api` thereafter. PostgreSQL, MongoDB and Redis are required by the application; identity tests use real PostgreSQL/Redis with controlled providers.

## Configuration and database

Use ignored `.env` based on `.env.example`. Set distinct cryptographic keys, terms/default timezone, session/reset/reauth lifetimes and rate/retention values explicitly. Generate OTP/encryption keys as 32 random bytes encoded in base64; use a separate high-entropy JWT key of at least 32 bytes. Keep old OTP/encryption key pairs in `IDENTITY_PREVIOUS_KEYS` while pending intents/proofs drain. No secret belongs in Git, logs or queue data.

Choose an approved production initial reputation (0..100); development/test may leave it uninitialized. Seed STAFF without administrative grants until product owners approve its mapping. Configure SMTP, a private S3-compatible bucket and ClamAV INSTREAM scanner. Production SMTP requires TLS; production S3 endpoint requires HTTPS. Bucket policies must block public access and lifecycle rules must remove orphan objects left by a crash between S3 upload and metadata commit.

Review migrations before running these commands against the intended development database:

```powershell
pnpm db:validate
pnpm db:deploy
pnpm build
pnpm identity:seed
pnpm identity:bootstrap-admin <existing-verified-active-user-uuid> "Operator reason"
pnpm dev
```

Bootstrap never creates an account or sets a password; it assigns ADMIN to an existing verified ACTIVE account and appends audit, including no-op outcomes. No HTTP Admin grant is provided. For subsequent development migrations `pnpm db:migrate` verifies the maintained runtime `prisma/schema.prisma` and uses it for migrations. The v3 product catalog is kept separately in `prisma/catalog.prisma`; do not deploy future catalog models with `db push`.

## Checks

```powershell
pnpm lint
pnpm check-types
pnpm build
pnpm test:foundation
pnpm test:identity
pnpm test:identity:integration
```

Integration reads `TEST_DATABASE_URL`/`TEST_REDIS_URL` when set, otherwise existing connection settings. PostgreSQL account must be allowed to create/drop a unique test schema; Redis account must allow the disposable queue and expiring HMAC rate keys. Tests never migrate the normal application schema, use a random queue prefix and clean their schema/queue in `finally`. Run only with credentials authorized for test data. Provider tests listen only on local ephemeral ports and send no external email.

## Walkthrough

Swagger is at `/api/docs` in development/test. Identity endpoints use `/api/v1/...`; unsupported/unversioned identity paths return 404. `/api/health` and `/api/health/ready` remain neutral.

JSON responses follow Memora: `{success:true,message,data,meta?}` or `{success:false,message,statusCode}`. Read tokens/profile/upload results from `data`; user list rows are the `data` array and cursor/hasMore/limit are in `meta.pagination`. Registration/resend/forgot use `data:null`. A 204 response has no JSON body. Validation `message` is one string joined with `; `; 5xx hides internal details. This replaces the previous response shapes in the unreleased v1 API.

1. Register valid fields and accepted terms; receive neutral 202 without tokens or a database account. Registration data is encrypted in Redis for five minutes. Obtain the code from a controlled mailbox. Duplicate signup cannot replace profile/password.
2. Verify six-digit REGISTER code once to create a verified ACTIVE account, then login. An inactive account cannot obtain a session; invalid proof responses are neutral.
3. Access own `/me` and authenticated public `/profiles/{userId}` projections. Public profile excludes email/roles. Profile edits accept only the declared fields.
4. Rotate refresh serially. Replay revokes that family; logout accepts its refresh credential even after access expiry. Logout-all revokes all families.
5. Request recovery at `POST /api/v1/auth/password/forgot` with `{email}` (202). Verify its OTP at `POST /api/v1/auth/password/verify-otp` with `{email,otpCode}` (200, `data:{resetToken,expiresAt}`); this does not change the password. Then call `POST /api/v1/auth/password/reset` with `{email,resetToken,newPassword,confirmNewPassword}` (204). The one-use grant is consumed, old families fail, status is preserved, and a change notification is queued. No automatic sign-in occurs. The old OTP-plus-password reset body is rejected.
6. Upload multipart `image`; 202 returns QUARANTINED. Poll `/me/avatar/uploads/{assetId}`. Only content-valid scanned CLEAN images become selected/signed; failure keeps the previous avatar. Delete also cancels pending uploads.
7. Admin/current explicit grants control masked listing and lock/unlock with reason. STAFF add/remove additionally needs a session-bound one-use proof from `/auth/reauthenticate` with purpose `STAFF_ROLE_CHANGE`.

Durable email/avatar reconcilers run every five seconds. Email retries are bounded with exponential backoff and leased records recover after expiry. Monitor pending/failed intents and quarantined/cleanup metadata. Never recover by exposing OTPs, editing audit or accepting unscanned objects. Provider acceptance before sender crash can duplicate an email, but cannot consume a proof twice.

See [validation](validation.md) for evidence and release limits and [HTTP contract](contracts/http.md) for all 21 routes.
