# Learning Request FE extension — 2026-10-12

User approved the contract and requested implementation in this session. Scope: services/api only; retain existing endpoints, moderation, authorization, expiry and optimistic concurrency. No commit/push is authorized.

## Contract

- `teachingOverview`: optional nullable plain text, 20–3000 Unicode code points after sanitize/trim when supplied. Request-specific description of what its owner can teach; included in publish/edit moderation.
- `offeredSharingSkillIds`: optional list, default [], up to 10 distinct UUIDs referencing the request owner's active, visible Sharing Skills with ACTIVE catalog skills. Read current public skill metadata (id, skill id/name, level, verification status), never trust client labels or verification. Recheck at create, edit and publish. Archived/hidden/inactive skills are omitted from public projections; owner retains selected IDs to repair selections.
- `preferredAvailability`: optional nullable `{timeZone,weeklySlots}`; IANA timezone and up to 5 `{weekday,startTime,endTime}` slots. Weekday MON–SUN, exact HH:mm, same-day end > start, no overlapping/duplicate ranges on a weekday; adjacent ranges allowed. Canonical order weekday/time. Retain timezone/local wall-clock times rather than fabricating dates or UTC weekly offsets. No automatic Session/Schedule.
- Retain legacy `preferredSlots`. A request uses either a nonempty absolute schedule or nonempty weekly schedule. PATCH with a new schedule clears the other schedule; supplying both nonempty is rejected. Omission keeps a field; explicit null clears optional overview/availability/credit; [] clears offered skills. These additions are optional so existing clients remain valid.
- `desiredCreditPerHour`: optional nullable decimal string in Credit, > 0, at most two fraction digits and ten whole digits, normalized to two digits in output. Store BIGINT hundredths (100 units = 1 CR), matching existing Credit conventions. It is an indicative hourly budget, never wallet Hold or the final negotiated price.
- Create/PATCH accept all new fields. Owner/reviewer/detail/feed/recommended projections expose the card fields; public skill metadata is fetched in batches through Sharing Skills owner contracts. Text remains in the existing description for what the owner wants to learn.
- `GET /api/v1/tags?q=&limit=&cursor=`: ACTIVE canonical catalog tags, `{id,label}`, case-insensitive literal label search, default limit 20, range 1–100, cursor bound to filters. Read-only catalog route following existing public Skills routes; unknown properties and malformed cursor rejected. Existing tagIds select canonical IDs. No tag administration or new taxonomy.

## Data and compatibility

Add nullable teaching_overview/preferred_availability/desired_credit_per_hour and a request-owned composite association to SharingSkill, retaining historical references and existing rows. Use an additive migration, update runtime schema generator (schema.prisma is generated) and scoped identity generator. Preserve v3 catalog as the logical reference; document this user-approved extension. Ownership/availability checks are via Sharing Skills exported service, not cross-module writes.

## Verification

Test accepted payload and malformed timezones/times/overlap/credit, replacement/clearing, skill ownership and hidden/archived skill behavior, create/publish/edit moderation, full card projections and generated Swagger. Run complete Learning Request tests, affected Skills tests, lint/typecheck/schema validation/build and real PostgreSQL migration/persistence in a disposable schema where available. Deployment to the user's database is a separate operation; do not silently apply migrations.

## Constitution check

Scope/module ownership: compliant by design; PostgreSQL owns additions, Sharing Skills supplies validation/projections. Atomic request mutations and version checks retained. Credit is an input hint only. Auth/private metadata and Swagger requirements retained. Runtime results belong in validation.md; design does not claim verification.
