# Sonar remediation for PR #5

Reviewed on 2026-10-07 against PR head `07e276d`:
[refactor: align data models with srs v1.5](https://github.com/memora-alpha/skillhub/pull/5).
The analysis had 76 Open/Confirmed new-code issues, 38.9% duplication
(1,732 lines), and reliability rating E. This report covers remediation;
it does not establish a passing analysis of the modified code.

## Source changes

- `docs/data_model_generator.py` owns the shared v2/v3 catalog and rendering.
  Both original entry points load isolated instances. v3 retains its four hidden
  conceptual associations and additional direct relationships; logical data is
  identical across versions. Existing reviewed diagram files are not regenerated.
- Rendering is split into layout, edges, entities, preview text and validation
  helpers. Repeated domain labels use constants; the unused relation variable
  is removed.
- Prisma catalog generation separates scalar types, native string types and
  field attributes, and uses constants for repeated composite keys.
- Runtime schema generation uses `String.raw` for the model regular expression.
  Email delivery uses `.includes()` for the supported-kind guard.

## Sonar issue decisions

The authenticated PR issue list now has **42 False positive, 9 Accepted and
25 Open** issues. The 25 remaining issues are addressed by local source changes
and await a published commit and another analysis.

| Issues                                           | Decision       | Reason                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41 `VARCHAR` and 1 `CHAR` to `VARCHAR2`          | False positive | Oracle PL/SQL rules are applied to PostgreSQL migration SQL. Preserve PostgreSQL native types; `payments.currency` is a fixed three-character code.                                                                                                                          |
| Migration lines 55 and 73, missing outer `WHERE` | Accepted       | The role backfill intentionally assigns every existing user its highest administrative grant, falling back to USER. The configuration backfill preserves existing non-null types with `COALESCE` and supplies missing types. These are one-time operations in a transaction. |
| 7 repeated enum literal findings                 | Accepted       | Separate PostgreSQL enum types deliberately share business status names. Preserve each type and its vocabulary rather than introducing a shared state type.                                                                                                                  |

Migration SQL was not changed. The v3 migration regression passed against a
disposable PostgreSQL schema, including retained profile and role data.
No comments were submitted to Sonar or GitHub.

## Validation

- Generator regression: 2 tests passed, including importing v2/v3 together,
  mutable-data isolation, all four generated XML outputs against pre-refactor
  SHA-256 baselines, reference/overlap checks and existing field catalogs.
- Additional before/after comparison: all v2/v3 catalog metadata, conceptual and
  logical XML, and field-catalog contents identical; all four preview PNG files
  byte-identical to output from the original generators.
- Regenerated/formatted Prisma catalog and runtime schema: byte-identical to
  pre-refactor versions. Both schemas validate.
- API lint, typecheck and build passed.
- `test:identity`: 11 passed, no skips.
- `test:runtime-v3`: 4 passed, no skips. Localhost tests initially failed with
  sandbox `EACCES`; the authorized run outside the sandbox passed.

## Remaining analysis work

Publish the source changes and rerun PR analysis to verify duplication and the
25 source findings. The current quality gate still displays Failed.
Scanner warnings also remain: unspecified Python version, source encoding and
an unresolved referenced/extended tsconfig. Confirm their exact file paths and
configuration in scanner logs before changing encoding or analysis scope.
Do not exclude migrations or documentation merely to suppress findings.
