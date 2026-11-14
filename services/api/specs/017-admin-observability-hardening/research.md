# Research: Admin Operations and API Hardening

## Dashboard metric source

**Decision**: Reuse authoritative ledger, fee, attendance, schedule and locked plan-version
facts; never derive Credit from payment VND or current catalog skill.

**Rationale**: Existing modules already define financial and historical invariants.

**Alternatives considered**: Recomputing from UI-facing tables was rejected because it
can disagree with posted ledger and historical path versions.

## Partial availability

**Decision**: Isolate expected source failures per dashboard section and return an
availability discriminator; validation, authorization and database-wide failures remain
whole-request failures.

**Rationale**: False zero values are operationally dangerous, while a completely blank
dashboard is unnecessary when one independent source fails.

## Work-item normalization

**Decision**: Use an allowlist of source-owned kinds and `UNCLASSIFIED` severity where a
source has no authoritative severity.

**Rationale**: A unified queue should normalize shape, not invent business state.

## Proxy and device identity

**Decision**: Trust zero proxy hops by default. Accept a bounded configured hop count,
use optional `X-Device-Id`, and use an application-secret HMAC of User-Agent only as a
temporary fallback.

**Rationale**: Blind forwarding-header trust enables spoofing; raw device/User-Agent
logging creates privacy and cardinality risks.

## Audit volume

**Decision**: Audit successful sensitive detail reads only; do not audit dashboard or
list reads.

**Rationale**: Detail access is security-relevant while high-frequency aggregate/list
audits would obscure actionable events.
