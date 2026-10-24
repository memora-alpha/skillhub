# Proposed tags reviewed with a Learning Request

Accepted user amendment, 2026-10-24: USER proposes tag labels directly in a post;
Staff reviews the post and tags together; approved tags enter the shared catalog.
Scope: API `learning-requests`, `skills`, audit snapshots and runtime schema.

## Contract and behavior

Create/PATCH Learning Request accept optional `proposedTags: string[]`, alongside
existing `tagIds`. Example tag fields (other required content/version fields still
apply):

```json
{
  "tagIds": ["33333333-3333-4333-8333-333333333333"],
  "proposedTags": ["React Native", "Luyện phỏng vấn"]
}
```

- Reuse Tag normalization: NFC, trimmed/collapsed whitespace, 1–80 Unicode code
  points, no control characters; case-insensitive key preserves accents.
  Duplicate proposed keys are rejected. Existing maximum 10 includes both tag IDs
  and proposed labels. Null is invalid. Omitted create defaults to `[]`; omitted
  PATCH preserves; `[]` clears proposals.
- Proposals are stored on the post, without creating canonical Tags or standalone
  TagCreationRequest rows. Owner create/edit/read/mine and Staff queue/decision
  responses include `proposedTags`; public responses expose canonical tags only.
- Publish with proposals always becomes `PENDING_MODERATION/PENDING`, even if text
  is otherwise clean. `flaggedCategories` includes `PROPOSED_TAGS`. Proposed labels
  also participate in text filtering. Rule configuration must remain available.
- Edits of published posts re-filter the new version. Adding proposals queues it;
  clearing proposals follows existing moderation behavior (clean content may OPEN).
  Rejected posts must be edited to DRAFT and republished. Existing expiry and
  editable-state restrictions remain in force.
- Existing Staff approve endpoint approves the whole post and all its proposals.
  Live STAFF/ADMIN plus `learning-request:approve` is required. USER remains denied
  even with an incorrectly granted permission. Standalone admin tag endpoints
  remain ADMIN-only; Staff receives no general catalog-management permission.
- Approval creates ACTIVE Tags or reuses an ACTIVE canonical key, attaches IDs,
  deduplicates links, clears proposals, and opens the reviewed post version.
  INACTIVE/ARCHIVED collisions return `409 TAG_UNAVAILABLE`; never reactivate them.
  Staff can reject the post with a reason for the owner to correct its proposals.
- Rejection keeps labels for correction, creates no Tags, and uses existing
  rejection notification delivery. Cancellation/expiry creates no Tags either.

## Ownership, transactions and audit

Post lock/status/version checks precede catalog writes. Skills exposes the
`RequestTagApprover` application port implementation, rechecks reviewer identity
and permission, and reserves normalized keys in deterministic order through the
existing insert-on-conflict repository. Request owns post tag-link replacement.
All Tag/status/link/audit changes use one caller-owned PostgreSQL transaction.
Any failure rolls everything back; existing Serializable retries handle database
conflicts. One post version can be reviewed once; concurrent posts sharing a label
reuse one Tag. No nested transaction or asynchronous catalog promotion.

New Tag creator is the reviewer; the post retains its owner. `TAG_CREATE` audits
record newly inserted Tags; post review audit records proposed labels and resulting
canonical IDs. No new outbox event type is introduced.

## Rollout

Apply `20261024000000_learning_request_proposed_tags` before restarting the API.
It adds `learning_requests.proposed_tags TEXT[] NOT NULL DEFAULT '{}'`, bounded to
10 entries and disallowed on OPEN/NEGOTIATING/MATCHED/CLOSED posts. Existing posts
retain their status and tags. The runtime generator carries this additive field;
historical catalog is unchanged. No identity seed or new grants are necessary.
Web/mobile must send `proposedTags` and display proposals in owner/moderation views;
this task only changes the backend.

## Constitution check and validation

- Scope/layers/ownership: Pass in source; only API files change. Skills owns
  canonical Tag writes; Request owns its proposals and links through ports.
- Atomicity: one PostgreSQL transaction with real audit validation; no providers.
- Authorization: live role/permission checks at review and catalog boundaries.
- Contract/config: additive DTO/Swagger fields, existing text rule configuration;
  UTC timestamp behavior unchanged.
- Delivery/jobs: existing transactional rejection outbox is reused.
- Verification: Pass for the affected feature checks below. The application
  schema migration is not automatically deployed by this implementation task.

### Verification on 2026-10-24

| Check                                                                              | Result                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma Client generation and runtime schema regeneration/format validation         | Pass. Runtime adds only the proposal field; unrelated historical formatting retained.                                                                                                                                                        |
| API `tsc --noEmit`, `nest build`, full `eslint . --max-warnings 0`                 | Pass. Local installed tool binaries were used because Corepack could not download pnpm in the sandbox.                                                                                                                                       |
| Standard `test:learning-request` test list plus Tag policy and audit policy checks | 121 passed, zero failed/skipped. Includes the first 10 proposal tests.                                                                                                                                                                       |
| Focused proposal tests after adding production SkillsModule DI coverage            | 11 passed, including all original proposal cases and module dependency resolution.                                                                                                                                                           |
| PostgreSQL proposal integration                                                    | 7 passed (parent plus 6 scenarios), on a disposable local schema. Real migration, queue/feed/lookup, Staff permissions, canonical-key race, competing post decisions, inactive collisions, audit rollback and database state guard verified. |
| Existing FE extension PostgreSQL/HTTP integration                                  | 7 passed (parent plus 6 scenarios), on a disposable local schema.                                                                                                                                                                            |

The optional wider `test/skills/bootstrap.test.mjs` suite failed because its
SkillNotificationModule fixture does not provide ConfigService to
SmtpTransactionalMailer. This SMTP/notification wiring is outside this change;
the new focused test verifies the actual SkillsModule and exported approver.
A combined integration run also had a local connection timeout; the proposal
integration passed when rerun independently. No normal application schema was
migrated. Web/mobile UI integration and application migration rollout remain
outside this backend implementation.
