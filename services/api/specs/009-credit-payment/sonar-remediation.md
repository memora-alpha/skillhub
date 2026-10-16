# SonarCloud PR 33 remediation

Date: 2026-10-16. Published analysis reviewed: `f0a41c3b271357c38814c5763faac83ca89dc900`.
Project: `memora-alpha_skillhub`, PR `33`, branch `feat/credit-payment`.

The reviewed Quality Gate failed one condition (Reliability E). There were two
Open/Confirmed new-code issues, 0.0% new-code duplication and no new security
hotspots. This snapshot does not establish the result of a future analysis.

## Reviewed findings

| Issue                                                                                                                          | Rule and location                                                                                                     | Resolution                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [AaFCnyxNMmG0hAe3zpGS](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&pullRequest=33&open=AaFCnyxNMmG0hAe3zpGS) | `plsql:DeleteOrUpdateWithoutWhereCheck`, `prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql:46` | **Accepted on SonarCloud**, visibly verified on 2026-10-16 after the user authorized GitHub sign-in. Rationale recorded in issue Activity by NHH. Published migration contents remain unchanged. |
| [AaFCnypRMmG0hAe3zpGR](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&pullRequest=33&open=AaFCnypRMmG0hAe3zpGR) | `typescript:S7780`, `src/modules/credit/presentation/http/wallet.responses.ts:10`                                     | Replaced the escaped string with a `String.raw` template literal. The runtime OpenAPI regex must remain identical. Fresh cloud analysis is pending publication.                                  |

### Rationale recorded for the SQL issue

Intentional full-table data migration: initialize `last_entry_sequence` for every
existing wallet from that user's maximum backfilled ledger entry sequence, or
zero when the user has no entries. The correlated predicate `t.user_id=w.user_id`
keeps each wallet's watermark scoped to its owner. Updating every wallet is
intentional, including wallets without ledger entries. This changes only the sequence
watermark, not monetary balances. It runs inside an explicit transaction with
financial tables locked and history preflight checks. Keep this published
migration unchanged to preserve its checksum; accept the intentional broad
update rather than adding a cosmetic WHERE clause.

## Analysis warnings

- Source encoding: strict UTF-8 decoding of tracked text source/config files found
  no invalid byte sequences locally. The affected scanner file is unknown because
  the visible warning does not include its path. Scanner logs are still required
  before claiming this warning resolved.
- Referenced/extended tsconfig not found: API inheritance uses existing relative
  repository paths. Web extends `@skillhub/typescript-config/nextjs.json` and
  mobile extends `expo/tsconfig.base`, which depend on installed packages. These
  are possible causes in Automatic Analysis, not confirmed scanner locations.
  Do not change frontend configuration or analysis scope without scanner evidence.

## Verification and cloud boundary

Local verification passed:

- Full API lint, Prisma generation + TypeScript check, and Nest build.
- OpenAPI decorator metadata for all seven money fields matches the pattern in
  `f0a41c3` exactly, accepts `0.00`, `100.00`, `-0.01`, and rejects malformed
  decimal separators/precision.
- Credit money/cursor tests: 4/4 passed.
- Wallet HTTP/OpenAPI suite using isolated real PostgreSQL: 6/6 cases passed,
  including parent case; no skipped tests.
- Focused Prettier check and `git diff --check`.

These checks are separate from cloud issue closure. No migration rewrite,
suppression, rule exclusion or quality-profile change is part of this
remediation. Payment remains disabled by default and its pending
implementation/release gates remain unchanged.

Automatic approval review initially blocked OAuth sign-in. The user subsequently
explicitly authorized SonarCloud login through the current GitHub account and
the Accepted disposition. Sign-in completed as NHH; the issue Activity records
the rationale and `Status changed to ACCEPTED (was OPEN)`. This resolves the
cloud disposition blocker. The local String.raw source fix still needs a commit,
publication, and a fresh analysis before its cloud closure can be verified.

After applying Accepted, the PR summary visibly reported **Quality Gate Passed**
on the existing analyzed revision `f0a41c3`, with one new issue still open, one
Accepted issue, 0.0% duplication, and no new security hotspots. Both analysis
warnings remain. This is a gate recalculation after issue triage, not a fresh
analysis of the uncommitted String.raw fix.
