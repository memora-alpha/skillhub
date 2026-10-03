# Feature Specification: Danh tính người dùng

**Feature Branch**: `feat/user-identity`
**Created**: 2026-10-03
**Status**: Reviewed for planning; production policy gates remain below.
**Input**: “Tạo branch từ dev và sử dụng speckit để plan phần tiếp theo Danh tính”.

## Sources and scope

Sources: [SRS V1.3](../../../../docs/SRS_SkillHub_V1.3.docx), sections 6.1–6.2, 18.2–18.7, 18.25, 18.27–18.30; [entity catalog](../../../../docs/SkillHub_Entities_Fields.md), section 1; [API roadmap](../../README.md), stage 1.

Backend scope: email registration/verification, login, session renewal/logout, password reset, own/public profiles including avatar, permissions and minimal account administration/audit. A User can learn and share; Guest is unauthenticated access, not a stored role.

Google login (FR-AUTH-04, Should) is deferred to a separate feature with safe linking. Anti-abuse (FR-AUTH-08, Should) is included to support mandatory auth journeys without changing its SRS priority. Skills/history enrichment, chat, Credit/wallet/signup bonus, dashboards, general notifications, email changes, account deletion, MFA and online ADMIN grants are deferred. This feature does not claim to implement the entire Profile or signup SRS.

## User Scenarios & Testing

### User Story 1 — Register, verify and sign in (Priority: P1)

A Guest creates one account, proves email ownership and signs in after activation.

**Why this priority**: Entry point for all authenticated journeys; SRS Must.
**Independent Test**: Controlled mailbox registration → verification → login, with expired/invalid cases.

**Acceptance Scenarios**:

1. **Given** a valid unused email and accepted terms, **When** registering, **Then** one pending account/profile/USER assignment and verification request exist; no active session is issued.
2. **Given** repeated/concurrent signup differing only by email case, **When** processed, **Then** at most one account exists and existing credentials/profile are never overwritten.
3. **Given** a valid unexpired six-digit registration code, **When** verified, **Then** email becomes verified and account ACTIVE once. Wrong-purpose, superseded, expired and consumed codes cannot activate it.
4. **Given** correct credentials, **When** logging in, **Then** only ACTIVE accounts receive a session; lastLoginAt updates and failedLoginCount resets. Other statuses issue no session.
5. **Given** delivery failure, **When** retry/resend occurs, **Then** account remains pending and resend limits hold without duplicate signup.

### User Story 2 — Renew and terminate sessions (Priority: P1)

A person renews a session and ends the current session or all sessions.

**Why this priority**: SRS Must logout and protection after compromise.
**Independent Test**: Two fixture sessions; renew/logout one, then logout-all.

**Acceptance Scenarios**:

1. **Given** a live session, **When** renewed, **Then** the old renewal credential becomes unusable and at most one successor is issued.
2. **Given** a used renewal credential, **When** replayed, **Then** its family is revoked. Concurrent renewals cannot create two surviving chains.
3. **Given** two sessions, **When** ending one, **Then** its access/renewal credentials fail subsequent requests and the other survives; logout-all invalidates both.
4. **Given** changed account status/permissions, **When** accessing protected actions, **Then** current authorization is enforced even with unexpired credentials.

### User Story 3 — Recover a password (Priority: P1)

A person proves email ownership to reset a password and receives a change email.

**Why this priority**: SRS Must recovery.
**Independent Test**: Existing active account with two sessions; request reset, consume proof and sign in with new password.

**Acceptance Scenarios**:

1. **Given** any email, **When** requesting reset, **Then** acknowledgment does not reveal account existence; eligible accounts receive a one-use proof.
2. **Given** valid reset proof and matching new password, **When** resetting, **Then** password changes once, proof is consumed, all old sessions are revoked and change notification is durably scheduled.
3. **Given** a locked/suspended account, **When** resetting, **Then** its status is preserved. Pending accounts require registration verification; deactivated recovery is denied neutrally.
4. **Given** concurrent consumes, **When** executed, **Then** at most one change commits and no partial revocation remains.

### User Story 4 — Maintain and inspect profiles (Priority: P2)

A User edits their profile and authenticated people view the public projection before interacting.

**Why this priority**: Identity portion of FR-PRO-01/02/03, SRS Must.
**Independent Test**: Update fixture profile and compare own/other-user views and invalid uploads.

**Acceptance Scenarios**:

1. **Given** an ACTIVE User, **When** editing name/headline/bio/timezone/locale, **Then** only validated owned fields change; credentials/status/roles/metrics cannot be edited.
2. **Given** another authenticated User, **When** viewing a public profile, **Then** no login email, payment data, credentials, sessions or internal administration information appears.
3. **Given** JPG/PNG/WebP <=5 MB, **When** uploaded, **Then** only content-validated and scanned images replace the avatar; failure leaves the previous image selected.
4. **Given** absent future skills/history, **When** viewing profile, **Then** identity fields work and deferred data is not fabricated.

### User Story 5 — Enforce privileged account operations (Priority: P2)

Admin and explicitly authorized Staff list users and lock/unlock accounts with audit. Only Admin assigns/removes STAFF.

**Why this priority**: Locking is SRS Must; permissions protect future features.
**Independent Test**: USER, STAFF without grants, delegated STAFF and ADMIN fixtures run identical operations.

**Acceptance Scenarios**:

1. **Given** missing permission, **When** managing an account, **Then** deny access with zero mutations.
2. **Given** authorized actor/reason, **When** locking ACTIVE account, **Then** status, all-session revocation and audit commit together; old credentials fail subsequent protected requests.
3. **Given** verified LOCKED account, **When** authorized unlock occurs, **Then** restore ACTIVE with audit but never restore sessions; other statuses cannot bypass transitions.
4. **Given** recently reauthenticated Admin, **When** assigning/removing STAFF, **Then** grant change and audit commit together. Staff cannot grant roles; no online ADMIN grant exists.

### Edge Cases

- Normalized email uniqueness races and pending retries that try to replace a password.
- OTP leading zero, expiry boundary, parallel wrong attempts, resend/verify race and stale email delivery.
- Neutral unknown-email responses and timing differences; abuse during storage outage.
- Refresh response lost/retried: strict replay revokes family; clients serialize refresh and sign in again.
- Login/refresh racing reset/lock; current actor permission changing during privileged action.
- Provider accepts email before sender crashes: physical email duplicate possible, domain mutation never duplicated.
- MIME spoofing, corrupt/oversized image, scanner failure, foreign asset and orphan cleanup.
- Missing required config; secrets escaping into logs, responses, audit or queue payloads.

## Requirements

### Functional Requirements

- **FR-001**: Enforce SRS registration validation: trimmed fullName 2–100 Unicode characters, letters/spaces/apostrophes/hyphens with at least one letter; valid email 5–254, trim/lowercase/no spaces; password 8–64 with upper/lower/digit/special, never trimmed; exact confirmation; agreeTerms=true. Store accepted terms version/time; locale vi/en default vi; supplied timezone valid IANA and mandatory after setup.
- **FR-002**: Create one pending User/profile/USER assignment per normalized email; reject client role/status/metrics and never overwrite existing data on duplicate signup.
- **FR-003**: Issue one-use six-digit codes. SRS registration defaults: expiry five minutes, five wrong attempts/challenge, resend >=60 seconds and <=five/hour/email, plus IP/device throttle. Configure limits and enforce under concurrency; resend invalidates old proof.
- **FR-004**: Only REGISTER proof activates pending accounts; endpoints choose purpose. All invalid/nonexistent/expired proof errors are neutral.
- **FR-005**: Login only ACTIVE; update last login/reset failed count. Wrong email/password share a generic failure and per-email/IP throttling applies; no tokens for nonactive accounts.
- **FR-006**: Bound session lifetimes, rotate renewal credentials, detect replay, support current/all-session logout and reject subsequent revoked credentials. rememberMe uses configured longer lifetime.
- **FR-007**: Neutral recovery, one-use RESET_PASSWORD proof, same password rules, all-session revocation and change email. Reset preserves status; privileged actors cannot set/read User passwords directly.
- **FR-008**: Separate own/private account and authenticated public profile projections; allow only owned editable fields. Bio is plain text safely handled; reputation/counters remain system-owned.
- **FR-009**: Accept scanned JPG/PNG/WebP <=5 MB with actual content and ownership validation; quarantine/failure never replaces current avatar.
- **FR-010**: Resolve explicit roles/permissions and ownership currently; deny unspecified operations/self-escalation. Staff receives no administrative grants until approved mapping exists.
- **FR-011**: Masked paginated user listing, authorized lock/unlock with reason and Admin-only STAFF assignment/removal with recent reauthentication; sensitive mutations/audit atomic; no online ADMIN grant.
- **FR-012**: Committed email intent survives crashes with bounded retries, stale-proof rejection and safe failure retention/recovery. No plaintext password/OTP/complete tokens persisted in delivery payloads or logs.
- **FR-013**: Reject unknown fields, store UTC dates, preserve current API error format and avoid invented reputation or signup financial writes.

### Key Entities

User; Profile; Role/Permission and assignments; one-use VerificationChallenge; Session/renewal history; protected EmailDelivery; owned scanned AvatarAsset; immutable AuditLog. Relationships and proposed fields belong to [data-model.md](data-model.md).

## Success Criteria

### Measurable Outcomes

- **SC-001**: All positive signup/verify/login cases succeed; all invalid/replayed/nonactive cases issue zero usable sessions.
- **SC-002**: Twenty concurrent normalized-email signups create exactly one User/profile/USER assignment.
- **SC-003**: Twenty concurrent consumes cause at most one proof transition; configured attempt/resend limits remain intact.
- **SC-004**: Logout/reset/lock reject every subsequent use of affected old credentials; unrelated device survives current-session logout.
- **SC-005**: Every permission/ownership denial causes zero mutations; each successful sensitive change has one matching audit outcome.
- **SC-006**: Public projection/log tests expose zero password/code/token/private email/payment fields.
- **SC-007**: Crash/retry preserves committed email intent; stale deliveries cannot activate/reset accounts.
- **SC-008**: All invalid avatar cases preserve the previous avatar; no unscanned object becomes visible.

## Assumptions and production decisions

Plan proceeds with explicit configuration and deny-by-default permission boundaries; these are not approved production policy values.

| Question                                   | Planning treatment                                                     | Must resolve before            |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------ |
| Exact Staff powers (SRS 18.31)             | Empty administrative grants; Admin gets defined identity permissions   | Any delegated Staff rollout    |
| Initial Reputation (SRS suggests 0 or 50)  | Nullable/not initialized until configured; no invented score           | Production onboarding          |
| Terms version/default timezone             | Required validated deployment configuration                            | Registration rollout           |
| Session/reauth TTL, throttle and retention | Required explicit config; isolated test fixture values only            | Runtime implementation/release |
| Email/S3/scan providers                    | Ports/local test doubles; fail closed if production integration absent | Production delivery/upload     |
| Google login/linking                       | Deferred Should feature                                                | Separate scope/spec decision   |

Admin bootstrap is audited operator assignment to an existing verified ACTIVE account; no public bootstrap. Broader status transitions/moderation/privileged profile edits are deferred. Public profile requires authentication (FR-PRO-03 actor User). Wallet/signup bonus and skills/history from SRS 18.30 are deferred to their roadmap stages. Production policy questions remain visible, without blocking technology-neutral planning.
