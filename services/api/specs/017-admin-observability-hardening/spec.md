# Feature Specification: Admin Operations and API Hardening

**Feature Branch**: `feat/admin-observability-hardening`

**Created**: 2026-11-14

**Status**: Planned

**Input**: Backend backlog, admin dashboard workbook, SRS v1.6, and the approved Track B decisions from the material review implementation plan.

## User Scenarios & Testing

### User Story 1 - Read a trustworthy dashboard (Priority: P1)

An Administrator can view user, learning, session, Credit, fee, and skill activity for
one explicit reporting period. Every value has a stable business definition and a
section that cannot be calculated is shown as unavailable instead of zero.

**Why this priority**: The current Admin Portal backlog cannot be implemented safely
until all cards and charts share one metric dictionary.

**Independent Test**: Seed events around reporting boundaries and verify each card and
daily trend against the approved definitions in two timezones.

**Acceptance Scenarios**:

1. **Given** complete source data, **When** an Admin selects a period, **Then** all dashboard sections use the same captured observation time and `[from,to)` boundaries.
2. **Given** one source is unavailable, **When** the dashboard is read, **Then** that section is marked unavailable and other sections remain usable.
3. **Given** a partial first or last day, **When** trends are returned, **Then** the partial bucket is identified and missing buckets are not fabricated.

---

### User Story 2 - Triage operational work (Priority: P1)

An Administrator can read one cursor-paginated queue of authoritative payment,
settlement, report, termination, verification, and tag-request work, then open a safe
detail projection without exposing private chat or evidence.

**Independent Test**: Seed one item of every supported kind and verify filters,
ordering, unclassified severity, access control, and detail-read audit.

**Acceptance Scenarios**:

1. **Given** work from several modules, **When** the queue is read, **Then** every item keeps its source status and stable open target.
2. **Given** a source has no severity, **When** it is projected, **Then** severity is `UNCLASSIFIED`, never inferred.
3. **Given** a detail read, **When** it succeeds, **Then** an audit record contains only actor, target, and request context.

---

### User Story 3 - Inspect learning paths safely (Priority: P2)

An Administrator can list and inspect learning paths using a neutral operational
projection covering participants, plan, schedule, attendance summary, settlement,
reports, and termination state.

**Independent Test**: Read paths in each lifecycle state and prove the response contains
no LiveKit token, message body, private evidence, or storage key.

**Acceptance Scenarios**:

1. **Given** an existing path, **When** its detail is read, **Then** the current and historical plan/session identifiers remain distinguishable.
2. **Given** a path with reports or termination activity, **When** detail is read, **Then** only safe summaries and links to authorized admin work items are returned.

---

### User Story 4 - Receive predictable throttling (Priority: P2)

Clients receive correct rate limiting behind explicitly configured proxies, with limits
separated by network origin, authenticated principal/session, device, and endpoint risk.

**Independent Test**: Simulate direct and trusted-proxy requests, spoofed forwarding
headers, multiple accounts, and Redis failure; verify isolation, headers, and safe logs.

**Acceptance Scenarios**:

1. **Given** proxy trust is disabled, **When** a forwarded IP is supplied, **Then** it does not replace the direct peer address.
2. **Given** a limit is exceeded, **When** the client receives 429, **Then** `Retry-After` and rate-limit headers are present and readable through CORS.
3. **Given** clients share one IP, **When** only one authenticated principal exceeds its limit, **Then** unrelated principals retain their own quota.

### Edge Cases

- Periods crossing daylight-saving changes or local midnight still use unambiguous UTC instants.
- Empty datasets return available zero values only when the source query succeeded.
- One record matching several work-item categories appears once under its authoritative kind.
- Detail targets removed after list retrieval return not-found without leaking previous private data.
- Redis or one read model failing never silently disables a sensitive endpoint limiter.

## Requirements

### Functional Requirements

- **FR-001**: Only Administrators with explicit dashboard permission may read dashboard data.
- **FR-002**: Reporting windows MUST use inclusive start, exclusive end and a validated IANA timezone; the default is `Asia/Ho_Chi_Minh`.
- **FR-003**: User metrics MUST count accounts whose effective role is USER and exclude STAFF/ADMIN, while retaining a status breakdown.
- **FR-004**: Active learning users MUST be distinct users with valid attendance intersecting the period.
- **FR-005**: Scheduled and completed session metrics MUST use the same scheduled cohort.
- **FR-006**: Credit and fee metrics MUST reuse authoritative ledger/fee definitions and MUST NOT convert VND to Credit heuristically.
- **FR-007**: Each dashboard section MUST report availability independently.
- **FR-008**: Operational work MUST be limited to approved authoritative kinds and use `UNCLASSIFIED` when the source defines no severity.
- **FR-009**: Work list ordering and pagination MUST be deterministic and stable under concurrent inserts.
- **FR-010**: Work-item and learning-path detail reads MUST be audited; dashboard/list reads MUST not create audit noise.
- **FR-011**: Admin learning-path projections MUST exclude tokens, chat content, private evidence, and storage keys.
- **FR-012**: Dashboard and learning-path permissions MUST default to ADMIN only.
- **FR-013**: Proxy trust MUST default to disabled and accept only a validated hop count.
- **FR-014**: Rate limiting MUST distinguish network, principal/session, device, and endpoint-risk scopes.
- **FR-015**: A throttled response MUST include retry metadata and CORS exposure without logging raw device identifiers or User-Agent.
- **FR-016**: Backend QA MUST cover SH-120–125 and SH-127–128; frontend accessibility, optional Gemini, and Trial Booking remain out of scope.

### Key Entities

- **Dashboard Snapshot**: Observation time, reporting window, timezone, and independently available metric sections.
- **Dashboard Bucket**: One local-day interval with UTC boundaries and a partial-bucket marker.
- **Admin Work Item**: Safe normalized reference to one authoritative source item.
- **Admin Learning Path Projection**: Read-only operational summary assembled from owning modules.
- **Rate Limit Policy**: Endpoint group, dimensions, window, quota, and failure behavior.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every dashboard fixture produces the same totals when recalculated from the approved metric dictionary.
- **SC-002**: A failure in one dashboard section never changes another section and is visible to the caller in the same response.
- **SC-003**: Admin lists remain stable without duplicate or skipped records while new work arrives.
- **SC-004**: No tested Admin projection exposes a token, message body, private evidence, email, or storage key.
- **SC-005**: All proxy-spoof, shared-IP, account-isolation, and 429-header scenarios pass.
- **SC-006**: The focused backend QA matrix records an automated result or an explicit external-provider prerequisite for every in-scope backlog item.

## Assumptions

- PostgreSQL remains authoritative for the dashboard and work-item fields in scope.
- v1 trends use local calendar-day buckets only.
- Total/new-user metrics include locked and deactivated USER accounts and expose their status breakdown.
- Staff receive no dashboard or admin-path permission by default.
- Existing finance, report, verification, tag, learning-path, and audit module contracts remain authoritative; the admin module does not write their tables.
