# Validation quickstart

**Ordinary native integration follow-up — 2026-10-18:** Add `tests/wallet-payment-routes.test.ts` and the updated create tests to regression. [Current integration](contracts/normal-payment-integration.md) supersedes earlier normal-flags-off notes below. Current source enables native create/recovery/Confirm and independent status reads; web create stays unavailable. Run existing full installed test/lint/type/structure commands. JS export and synthetic web QR decoding do not close real API/payOS/native gates.100 task IDs/83 checks unchanged.

**Implementation checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Test-first eligible source batch is implemented. T043/T052/T076/T078..T088/T094 complete within DOC/L/C/W/source-check criteria;100 IDs,83 checked/17 unchecked, original68 completed task bodies preserved. Normal Payment/status/create/recovery/Confirm flags remain off. Private native QA read/financial entries are source-ready, not an activated or accepted deployment. Current fields, cleanup/store/claim/create/replay/QR/status replace earlier pending-source proposals below. D1/D2/D3/D4 are not reopened. Actual API/payOS/Android/iOS acceptance and full T100 stay gated; historical results keep their original scope.

## Current task commands / producers — 2026-10-18

Task ownership is updated without implementation: T052 tests/fixture-shape→schema/types; T076 tests→reducer/status; T078 tests→policyGET/scoped reads/inert QA read host. US3 checks below do not require create/storage/intent/encoder or T079/T080. Synthetic DTO hosts must receive required fields in T052, including QR-host shape only; QR renderer behavior is not a status prerequisite. Original completed tasks and all approval/evidence boundaries remain unchanged.

| Stage                                     | Command from apps/mobile after the indicated producer                                                                                                                                                   | Evidence limit                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T052 schema/fixture producer              | `node node_modules/tsx/dist/cli.mjs --test tests/wallet-payment-contract.test.ts`                                                                                                                       | Existing file; record new cases RED before schema, then GREEN. Include affected contract consumers in regression; no API proof.             |
| T076 reducer/UI producer                  | `node node_modules/tsx/dist/cli.mjs --test tests/wallet-payment-observation.test.ts tests/wallet-payment-status-ui.test.ts tests/wallet-payment-read-refresh.test.ts tests/wallet-payment-read.test.ts` | Existing files after T052; owner/status independent from US2. Missing field fixes are not already accepted by old green output.             |
| T078 policy/read-QA producer              | `node node_modules/tsx/dist/cli.mjs --test tests/wallet-payment-policy-read.test.ts tests/wallet-payment-read-qa-host.test.ts tests/wallet-payment-qa-entry.test.ts`                                    | Run only after T078 actually creates these files; inert auth/HTTP/QA fixtures, no actual Payment traffic.                                   |
| T081 tests then T082..T084 implementation | `node node_modules/tsx/dist/cli.mjs --test tests/wallet-payment-create.test.ts tests/wallet-payment-durable-recovery.test.ts`                                                                           | Files must first be created by T081 after full T080. RED test producer is not GREEN/native recovery; implementation must satisfy all cases. |
| T085 UI/QA producer                       | `node node_modules/tsx/dist/cli.mjs --test tests/wallet-payment-create-ui.test.ts tests/wallet-payment-qa-host.test.ts tests/wallet-payment-qa-entry.test.ts`                                           | Only after files exist; no production/preview financial host or invented real invocation.                                                   |

At stable source checkpoint T094 run appropriate focused + affected/full mobile regression, lint/types/structure per existing commands below. T094.status needs T052/T076/T078, not full T094/create/QR. T094.qr needs T052/T076/T093 on the current revision, not T078/create/storage; run the existing QR commands below only after those affected producers and fixture corrections pass, recording revision/provenance. T094.create needs T086/T087. Full parent needs all required scopes and regression; T098.qr/T099.qr consume only T094.qr plus their actual platform prerequisites. T095 actual policy/status/related-refresh reads requires latest T094.status and executable approved read-QA binding/auth/data. No command above is run in this documentation invocation. ActualAPI/payOS/native and first-rollout migration/ingress/all-instance readiness need the existing6.1 operational runbook; a source/test host is not proof of deployed binding.

## Current replan entry — 2026-10-18

BE7fc0f83 is present at HEAD5101aea. [Source/contract audit](contracts/backend-review-7fc0f83.md) clears SOURCE_SYNC_REQUIRED; D1 is source-verified with explicit limits.100 IDs/68 checked remain, tasks.md is preserved. This is a docs-only run; no test/API/migration/payment/native execution is claimed. Older dated command/output records below are historical.

Next authorized work must first update task scopes for required recovery DTO/policy/equal-version projection, finalize T079/T080 cleanup and support-stop, then tests-first native persistence/claim/create/QA composition. Existing test files may run; do not invoke proposed wallet-payment-create.test.ts, wallet-payment-durable-recovery.test.ts or wallet-payment-qa-host.test.ts until their producer actually creates them. Owner status/recovery-field tests must be independently runnable without an intent/encoder. At a stable source checkpoint run existing focused tests, full mobile regression, lint/types/structure once; keep stage prerequisites/subset evidence.

Before real A/G/native actions, fill the existing6.1 runbook with deployed SHA/migration20261018000000_payment_recovery_guards/backfill outcome, first-rollout exact POST ingress block/all-instance upgrade, enabled-vs-pause/current-channel config, named support/operator/operations owner, actual executable QA build/entry/owner A/B/data and explicit actions/amount permission. Environment existence and two-device workflow are approved; binding/evidence are not verified. No provider credential in mobile/logs. No restore/channel/report command is run by mobile planning.

Exercise mapping loss/same ID200, map retained/resource missing409, policy snapshot→POST race, paused replay vs disabled-provider503, legacy missing-checkout list omission, recovery metadata/null at equal version, PAID independent refresh and A→B→A/process death separately by evidence layer.404/empty discovery/true policy never clears local unknown outcome or known restore incident. QR tools/W complete; actual native pixels/bank scan/posting remain separate.

**QR implementation checkpoint — T089..T093**: QR files now exist. From apps/mobile run `node node_modules/tsx/dist/cli.mjs --test tests/wallet-qr-renderer.test.ts tests/wallet-qr.test.ts`; observed15/15, zero skip/fail. Full regression431/431; lint/check-types/check-structure532 PASS. Web/Android/iOS JS export with source maps and no bytecode verified imports, not device runtime. Use `EXPO_NO_DOTENV=1` and process-local loopback API config for inert exports; never use a live API to satisfy W.

Tracked decoder command (after a synthetic capture/provenance exists): `node scripts/wallet-qr-validation.mjs --image .expo/wallet-qr-batch/unicode-320-large-text.png --fixture unicode --layer W --provenance .expo/wallet-qr-batch/unicode-320-large-text.json`. This exact invocation was observed to pass; all paths are ignored task evidence, not committed assets. `--help` documents image/fixture/layer/provenance options. Provenance contains image SHA256, sourceRevision, build hash, producer, pixelRatio, viewport and renderedQuietZoneModules=5 (minimum4 verified); native also requires device. The CLI checks hashes/fields/pixels but cannot certify the origin of a caller-forged screenshot, so retain capture logs. It never accepts/logs raw live QR, imports encoder, calls HTTP or claims financial acceptance.

Manual W path uses existing authenticated app→Profile→Bộ giao diện mobile→Ví Credit mẫu→QR local mẫu độc lập, i.e. /ui/wallet-preview?view=qr. Fixture auth/reads in the observed browser procedure were intercepted locally, not real accounts. QR view instantiates no US2 create/intent/store, own QueryClient or account client. Record no-egress, same-version null, actual SVG draw-fault/retry, dense/Unicode/capacity, Back and A/B logout separately. NA/NI/bank scan and A/G remain NOT_RUN; no real Payment/Confirm activation.

**Historical approved-scope task validation — 2026-10-17**: [tasks.md](tasks.md) applies selected D2/D3/workflow, preserving100 IDs/63 completions. Next independent increment is T089 DOC→T090 red tests→T091 pinned tools/adapter/source smoke→T092 independent decode harness→T093 actual W pixels. No create/storage/D1/live API dependency for synthetic QR. Do not run absent test/script filenames or install dependencies in this docs invocation.

After T090 actually creates its test file, from apps/mobile run `pnpm exec tsx --test tests/wallet-qr-renderer.test.ts` (installed fallback: `node node_modules/tsx/dist/cli.mjs --test tests/wallet-qr-renderer.test.ts`). Record initial missing implementation/import as RED, not a skipped PASS. After T091 installs selected tools and implements encoder/renderer, require runnable L cases green plus source/web/Metro graph/bundle checks; they do not prove Hermes/native device behavior. After T092 creates the harness, its documented CLI must accept actual screenshot path and synthetic fixture identity; obtain exact arguments from the implemented help/runbook, not an invented command here. T093 must capture mounted app SVG at320/375/430/large text, then independently decode those pixels; Node raster/export alone is insufficient. Run affected/full regression and lint/types/structure at T094.qr once source stabilizes, not after each docs task. No required renderer/decoder case may be skipped and reported passed.

T085 now owns the approved future `qa/payment-qa-host.tsx` plus test-first `wallet-payment-qa-host.test.ts`, shared authenticated runtime binding and production/preview fail-closed behavior; T096 owns actual environment/build/entry/runbook/data/permission verification. Environment existence was confirmed by the user; no actual invocation/result is invented. D1 still blocks full create/recovery. Missing executable binding must remain BLOCKED, no preview financial egress or normal Confirm activation.

**Historical clarified inputs — 2026-10-17**: [D1..D4 record/source audit](contracts/completion-proposal.md) records D2 native-first storage, D3 QR dependency scope and D4 two-device QA-entry design approved. User confirms acceptance environment already exists; actual binding/results remain unverified. D1 operational retention exceptions/total-loss remains BLOCKED despite foundation no automatic TTL. This documentation-only invocation installs nothing, runs no financial/API/device tests, preserves63/100 and leaves flags off.

For section6.1, verify actual values in the existing environment: API/build revision, executable entry/invocation, migration/provenance/config, A/B known IDs and PAID Wallet/history snapshots, provider channel/mode/device and specifically authorized actions/amount, D1 policy, QR decode and intent/HTTP/posting counters. D4 QA host/entry design is approved, not yet implemented; task scope is now synchronized; implementation and an executable entry are still required. Health200 only checks storage dependencies, not payOS/channel or Payment readiness. Never use preview financial egress or sample configuration as deployed evidence.

**Historical I2 checkpoint — 2026-10-17**: I1 and T067..T075/T077 now have scoped L/C/W evidence;63/100 tasks complete. Normal Payment/status/Confirm stay disabled; T076 discovery is NOT_SELECTED and T078/T095 await approved real-read environment/data. Later planning inventories below are historical. Newly runnable focused commands from `apps/mobile`:

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/wallet-payment-contract.test.ts tests/wallet-payment-observation.test.ts tests/wallet-payment-read.test.ts tests/wallet-payment-read-refresh.test.ts tests/wallet-payments-list.test.ts tests/wallet-payment-status-ui.test.ts
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-structure.mjs
```

Full regression remains `node node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts test/profile.test.mjs`. The ignored I2 browser procedure and prerequisites are recorded in [validation](validation.md); it uses synthetic auth/readers and zero Payment HTTP, not the operational QA runbook or T053 harness. Do not run create/recovery/renderer filenames before those gated producers create them. T094.status/T100.status records are subsets; their parent checkboxes remain unchecked.

**Current state (2026-10-17)**: [Validation](validation.md) records T001..T041 and T044..T051 complete within scoped criteria; P4/P5 are preparation only. T042/T043/T052..T062 stay unchecked. Normal status/Confirm and all Payment capabilities remain unavailable; owner reads/P4 behavior are unchanged. P5's four test files now exist; tracked T053 runner still does not. Current inspected checkout is4121c3f, with BE Payment081b3d2/f80ef7a compared with17e3ac1. Wallet/history wire is unchanged. Payment source now exists; actual-contract integration/REVIEW/version, GAP-06 retention/correlation decisions and QR-01/environment evidence remain pending. See [Payment HTTP](contracts/payment-http.md). L/W models do not establish Payment C/A/G, QR decode/recovery or native acceptance.

## 1. Verify workspace and inputs

From the repository root:

```powershell
git branch --show-current
git status --short
```

Expected branch: `feat/mobile-wallet-payment-history`. Keep other work and the existing Git index intact. Read [plan.md](plan.md), actual [wallet HTTP contract](contracts/wallet-http.md), [Payment HTTP contract](contracts/payment-http.md), [integration gates](contracts/integration-gates.md), [UI flows](contracts/ui-flows.md), [recovery contract](contracts/payment-recovery.md) and [validation matrix](validation-matrix.md).

Prerequisites: repository-supported Node and pinned pnpm, installed root dependencies, and confirmed active feature `specs/006-wallet-payment-history`. Setup/install instructions are in [mobile README](../../README.md). Do not reinstall/reset dependencies merely to validate documentation.

From `apps/mobile`, inspect resolved paths without creating tasks:

```powershell
./.specify/scripts/powershell/check-prerequisites.ps1 -PathsOnly -Json
```

The mobile script may report the feature basename in its `BRANCH` field when no Git extension is installed. `git branch --show-current` remains the source of actual Git branch identity. Do not create a numbered Git branch from that field.

## 2. Documentation checks — runnable now

With root dependencies present, from the repository root:

```powershell
node node_modules/prettier/bin/prettier.cjs --check apps/mobile/specs/006-wallet-payment-history
git diff --check
```

Also verify local Markdown targets, no template placeholders, all GAP-01..08 dispositions present,25 unique FR rows, seven SC rows,30 V cases and62 unique task IDs with valid dependencies (49 complete within scoped criteria,13 unchecked: T042/T043/T052..T062). The feature contains16 Markdown documents including `validation.md` and the [QR test specification](contracts/qr-validation.md). Source results belong to dated implementation records; historical planning review remains a document review. Inspect working-tree changes without restaging or replacing existing indexed blobs. `git diff --check` alone does not inspect untracked documents; formatting/link/content checks must include this feature directory explicitly.

These checks establish document consistency only. Planning review is in [checklists/planning.md](checklists/planning.md).

## 3. Focused checks by implemented stage

All commands below run from the repository root **after the named files and their implementation exist**. P1..P5 commands are now runnable; T053+ runner/checkpoints remain future scope. A later stage's missing file is not a prerequisite for an earlier increment. Repeat mobile lint/check-types/check-structure after each source increment; run relevant regression on the current source revision before accepting that increment.

### P1 foundation — T004..T011

Run only the three foundation test files created by T004/T006/T007, then the required source checks:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-money.test.ts tests/wallet-runtime.test.ts tests/wallet-navigation.test.ts
pnpm --filter mobile lint
pnpm --filter mobile check-types
pnpm --filter mobile check-structure
```

Expected: exact decimal strings, current-owner scope, session cleanup, denied-cache handling, Back and preview/no-egress boundaries. After T011, Home shows unavailable balance instead of sample `0`/`180 CR`, and six normal wallet screens show truthful unavailable scaffolds until integrated. Other Home mock content stays outside scope. `wallet-payment-intent.test.ts` does not exist until T033/P4 and is deliberately excluded here; creation locks, unknown outcomes and restart preparation are verified at that later stage.

If this installed workspace's `pnpm exec` tries to reinstall dependencies and fails with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, use the already installed binaries from `apps/mobile` without reinstalling or changing package/lock files. These are the same tools as the package scripts:

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/wallet-money.test.ts tests/wallet-runtime.test.ts tests/wallet-navigation.test.ts
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-structure.mjs
node node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts test/profile.test.mjs
```

The observed P1 run used these installed tools; its full regression was split into `tests/*.test.ts` (308) and `test/profile.test.mjs` (8), with all current TypeScript test files at that directory level. No P2/P4/P5 test file or harness was created just to satisfy a command. The P1 web observations use an ignored ephemeral script/artifacts in `.expo/wallet-foundation-validation`; the reproducible tracked multi-scope runner below still belongs to T053.

### P2 Wallet/Home — T012..T020

After T019, run the Wallet adapter/owner tests with existing foundation tests, then the required source checks above and applicable HTTP/session/connection regression:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-money.test.ts tests/wallet-runtime.test.ts tests/wallet-navigation.test.ts tests/wallet-contract.test.ts
```

Within the T012..T020-only invocation, record these checks under T019/T020 and leave T056/T053+ unchecked, as explicitly requested. This requires neither History UI/tests nor payment model tests. Verify exact DTOs already in Credit, authorized virtualzero, forwarded signals,403 eviction, Home's shared projection and read-only recovery. Named T053.wallet/T054.wallet/T056.wallet/T057.wallet checkpoints can follow in an authorized later scope, without T031, a real200-record history dataset or payment capabilities.

P2 observed32/32 focused and328/328 full regression tests, mobile lint/types/structure, web export and9 ephemeral task-level browser observations. See validation for process-local loopback configuration, commands, request counts and responsive evidence. These observations do not implement the reusable tracked runner below or mark any T053+ checkpoint complete. The P1 unavailable-screen/browser expectations describe P1's historical state; current normal Wallet/Home use only accepted owner reads, while other capabilities stay unavailable.

### P3 History/detail — T021..T032

After T031, run History tests with the foundation tests, then the required source checks and applicable HTTP/session/pagination/connection regression:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-money.test.ts tests/wallet-runtime.test.ts tests/wallet-navigation.test.ts tests/wallet-history.test.ts tests/wallet-contract.test.ts
```

T031's transaction parser/HTTP/query cases are implemented in `wallet-history.test.ts`; existing Wallet/runtime/money/navigation tests are reused unchanged. The History fixture/runtime tests run with Wallet capability off, preserving US4 independence. Under this T021..T032-only invocation, record checks in T031/T032 and leave T056.history/T053+ unchecked. Verify owner-only detail/denial eviction, explicitlimit20 within unchanged max50, type/referenceType only, opaque snapshot cursors/server order and atomic full-chain refresh. The220-entry synthetic evidence and10 ephemeral P3 browser observations are in validation; they do not implement the tracked harness or prove backend signing/deployment/native behavior. Named T053.history/T054.history/T057.history checkpoints remain later authorized work, independent of Payment.

### P4 top-up preparation — T033..T041

Only after the preparation model/UI and T039 transport-seam test exist:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-money.test.ts tests/wallet-runtime.test.ts tests/wallet-navigation.test.ts tests/wallet-contract.test.ts tests/wallet-history.test.ts tests/wallet-payment-intent.test.ts tests/wallet-payment-transport.test.ts tests/wallet-qr.test.ts
```

Repeat the required source checks. These are L/model and isolated UI checks for approved-policy validation, explicit confirmation, synchronous claim, immutable intent, unknown outcomes and `replayAfterRenewal:false`; the transport seam does not establish an implemented Payment HTTP contract. Real Confirm remains unavailable. No test imports a guessed Payment endpoint/DTO or creates real payments.

P4 observed63 focused/359 full mobile tests (zero skip/fail), source checks/export and7 ephemeral W observations. Installed-binary fallback runs the same eight files above via `node node_modules/tsx/dist/cli.mjs --test ...` from `apps/mobile`. `wallet-qr.test.ts` executes shell/model assertions only; the independent renderer/decoder assertions in [qr-validation.md](contracts/qr-validation.md) are **BLOCKED**, not skipped or green. `.expo/wallet-p4-validation` contains safe task-level logs/screenshots, not a reusable T053 implementation. T042/T043 and all later tasks remain unchecked; P5 tests must not be invoked before their files exist.

### P5 status preparation — T044..T051

After T050, run the status/session suite independently of US2/T033..T041:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-runtime.test.ts tests/wallet-navigation.test.ts tests/wallet-payment-status.test.ts tests/wallet-payment-observer.test.ts tests/wallet-payment-refresh.test.ts
```

Use injected owner observations/readers and the foundation session scope; no intent coordinator or payment create API is needed. Verify all six states/unknown, superseded reads, denial, providerStatus/forged-link rejection and independent PAID wallet/history refresh outcomes. Repeat the required source checks. Once T051 creates the model-only restart/recovery cases, run them separately:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-payment-recovery.test.ts
```

Lost-ID/restart production recovery stays BLOCKED by GAP-06. `wallet-qr.test.ts` is test specification/fixture preparation at T038; renderer-dependent execution/decode assertions wait for vetted QR-01 implementation and T042 evidence. Do not count unavailable/skipped renderer assertions as passed QR acceptance.

P5 observed22/22 independent US3 tests (including its core-runtime session cases) with no US2 intent dependency. Run these four files alone to reproduce that boundary; general `wallet-runtime.test.ts` also retains historical P4 cases and is regression, not a US3 prerequisite:

```powershell
pnpm --filter mobile exec tsx --test tests/wallet-payment-status.test.ts tests/wallet-payment-observer.test.ts tests/wallet-payment-refresh.test.ts tests/wallet-payment-recovery.test.ts
```

Installed-binary fallback is `node node_modules/tsx/dist/cli.mjs --test ...` from `apps/mobile`. Historical P5 focused checks ran `tests/wallet*.test.ts`:86/86; full mobile382/382,zero fail/skip. P5 source checks/export and8 task-level W groups passed; `.expo/wallet-p5-validation` is ignored evidence, not a tracked T053 runner or T055 combined scenario. Normal route never configures a reader, reads URL outcomes or adopts a preview ID. Preparation observations keep the previous result stale because that baseline had no freshness contract; the new live design requires version-aware integration below. No API/channel/native/restart acceptance follows from these model results.

### Integration tasks T063..T100 — checks by implemented scope

The new backend contract is [payment-http.md](contracts/payment-http.md), inspected at4121c3f. Existing P4/P5 commands above remain preparation regressions against local models; their six-state and conflict-stale assertions do not establish support for REVIEW or live version ordering.

T063..T075 and T077 are now complete within L/C/W, with source and test files present. Run the existing I1/I2 tests from `apps/mobile` (or use the installed-binary equivalent below); these checks do not enable Payment or contact a financial deployment:

```powershell
pnpm exec tsx --test tests/wallet-payment-contract.test.ts tests/wallet-payment-observation.test.ts tests/wallet-payment-read.test.ts tests/wallet-payment-read-refresh.test.ts tests/wallet-payments-list.test.ts tests/wallet-payment-status-ui.test.ts
```

Installed-binary equivalent: `node node_modules/tsx/dist/cli.mjs --test` followed by the same six filenames. Known-ID/status tests remain independent of the US2 intent coordinator. Create/durable-recovery/discovery-UI/renderer files below remain future files; add them to commands only after their producing tasks create them. This planning invocation does not run these application checks.

| Future scope / prerequisites               | Required cases and expected result                                                                                                                                                                                                                                                                       | Evidence boundary                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| I1 actual schema/fixture and version model | Flat standard envelope; exact VND/Credit; numeric version/rate; nullable dates/checkout; REVIEW/unknown; wrong ID; reject malformed fields. Higher version progresses; lower ignored; equal-version checkout null suppresses old QR, equal status/quote conflict stays stale; newer EXPIRED→PAID allowed | C/L; fixtures synthetic, no real calls                                                                    |
| I2 owner GET and minimal discovery         | Session A→B, denial→later error, AbortSignal/ticket/coalescing, ID-only bootstrap, independent PAID Wallet/History refresh failures; discovery limit20/status cursor/reset with mutable membership, no ledger filters or auto-match                                                                      | C then W; A only with approved matching API/accounts/known IDs                                            |
| I3/I4 approved recovery + create adapter   | Freeze key/body before dispatch, one request across taps/remount, replayAfterRenewal:false on401,201/200 current-projection same-ID replay, body conflict,503 before replay, provenance409, commit-before-lost-response and app termination                                                              | C/L first. A/G/native recovery requires accepted retention/correlation and environment; otherwise BLOCKED |
| I5 QR-01                                   | Reviewed local encoder and independent decoder, raw bytes/Unicode/dense capacity/quiet zone, render retry retains ID, same-version suppression/no stale QR revival, no egress                                                                                                                            | QR specification blocked until implementation; W/native/approved merchant separately                      |

Record prerequisites, data, expected and observed results by the existing V case IDs; see matrix subcases. Do not use skipped assertions, model fields compared to themselves or BE test reports as new mobile financial evidence. Future source edits require the existing lint/check-types/check-structure and affected regression commands.

Task-to-file guide: I1 and I2 read/refresh/status/list-transport rows below have implementation evidence in validation. T076 discovery UI remains NOT_SELECTED; I3/I4 create/recovery and I5 renderer rows are proposed work behind decisions/gates. Existing stage commands above remain preparation/regression checks, not evidence of live financial acceptance.

| Increment                      | Producing tasks / proposed files under apps/mobile                                                                                                                          | Required checkpoint                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| I1 schema                      | T063: tests/wallet-payment-contract.test.ts and tests/fixtures/payment-api.ts; T064 parser                                                                                  | Red-before-schema, then exact DTO/null/version/unknown contract cases green                                      |
| I1 observation                 | T065: tests/wallet-payment-observation.test.ts; T066 live reducer                                                                                                           | Seven states, ticket/scope first, higher/lower/equal version and no same-version stale QR revival                |
| I2 owner reads                 | T067: tests/wallet-payment-read.test.ts; T068..T070 adapter/key/observer/hook                                                                                               | ID-only independent US3, signal/coalescing/denial/session/no-POST counters                                       |
| I2 related refresh / status UI | T071: tests/wallet-payment-read-refresh.test.ts; T072 binding; T075: tests/wallet-payment-status-ui.test.ts                                                                 | T077 status L/C/W plus source checks; PAID survives either/both dependent read failures                          |
| I2 optional discovery          | T073: tests/wallet-payments-list.test.ts; T074 list; T076: tests/wallet-payment-discovery.test.ts if selected                                                               | Not a prerequisite for T077; limit20/status/cursor membership separate from ledger                               |
| I3/I4 create/recovery          | T079/T080 actual decisions first; T081: tests/wallet-payment-create.test.ts and tests/wallet-payment-durable-recovery.test.ts; T085: tests/wallet-payment-create-ui.test.ts | T086/T087 C/W and simulated-boundary proof only; full process recovery needs separate actual native/API evidence |
| I5 renderer                    | T089 approval then T090: tests/wallet-qr-renderer.test.ts, tests/fixtures/wallet-qr-payloads.ts; T092: scripts/wallet-qr-validation.mjs                                     | Independent decode of pixels and explicit blocked native/channel rows; no fake model-equality or skipped PASS    |

Do not automatically add every future filename to P1 or US3 commands. Known-ID tests above remain independent of US2 intent/store/create/QR imports; fixture data must not import a live mutation dispatcher. T078 requires an approved real-read environment; T095 records A owner reads. T096/T097 require their separate create/channel scope, T098/T099 devices, and T100 reports precise blocked/observed layers. Task-level green from a subset is forbidden, and generation itself closes no runtime gate.

### Cross-story regression

After both T041 and T050, T055 checks combined intent-to-status model navigation and session cleanup through the browser harness. Each story's own tests above remains runnable independently. When the applicable source increment is ready, run the existing full suite for regression:

```powershell
pnpm --filter mobile test
```

Only files actually added at that point are included by the suite. Existing unrelated tests passing does not prove new Wallet behavior. Use controlled promises/request counters for races. Payment C needs newly implemented mobile actual-contract fixtures/adapters; A/G still need scoped integration and separate environment/activation evidence. The BE API is now implemented; existing P4/P5 model tests do not test it.

## 4. Isolated web preview — after P1/P2–P5 as applicable

Start the existing web preview from repository root:

```powershell
pnpm --filter mobile web
```

For a static bundle check when needed:

```powershell
pnpm --filter mobile exec expo export --platform web --output-dir .expo/wallet-preview
```

Use the explicit wallet model-preview host for inert Payment/QR model states. A tracked fake-owner loopback fixture can serve the actual wallet/history HTTP shape from [wallet-http.md](contracts/wallet-http.md); Actual Payment HTTP fixtures may now be planned from [payment-http](contracts/payment-http.md), but do not exist in current preparation or T053's existing interface. Add them only through later scoped tasks; no guessed wire data. Never point fixture scenarios at a real gateway or use `.env` production data. Keep environment overrides process-local/ignored, not committed public configuration.

The proposed `scripts/wallet-browser-validation.mjs` must own a reproducible harness interface: explicit app URL, `--mode model|http-fixture`, `--scope wallet|history|payment-model`, output directory and externally supplied browser-automation module path/runtime. HTTP-fixture mode requires an explicit confirmed contract revision; payment-model scope permits model mode only. These are planned CLI options for T053, not an existing runner. Do not hardcode a developer's cache path. Existing ignored `.expo` scripts are examples only. Browser automation library/browser version and availability must be recorded; if unavailable, record manual scripted results with the same case/scope IDs rather than claim automation ran. No new test dependency is installed during documentation work.

After T053 implements that interface and the browser module is explicitly configured, run only the implemented scope from `apps/mobile`. The Wallet command needs T019; it does not need History UI, real History records or payment preparation:

```powershell
node scripts/wallet-browser-validation.mjs --url http://127.0.0.1:8081 --mode http-fixture --scope wallet --contract 4121c3f --browser-module "$env:WALLET_BROWSER_MODULE" --output .expo/wallet-validation/wallet
```

After T031, History can run independently with its own 200-entry fixture dataset:

```powershell
node scripts/wallet-browser-validation.mjs --url http://127.0.0.1:8081 --mode http-fixture --scope history --contract 4121c3f --browser-module "$env:WALLET_BROWSER_MODULE" --output .expo/wallet-validation/history
```

Only after both T041 and T050, run combined payment-model preparation for T055; this is not a prerequisite for either read scope:

```powershell
node scripts/wallet-browser-validation.mjs --url http://127.0.0.1:8081 --mode model --scope payment-model --browser-module "$env:WALLET_BROWSER_MODULE" --output .expo/wallet-validation/payment-model
```

The runner must fail clearly if its module/app/fixture/scope prerequisites are absent, rather than treating an unimplemented scenario as passed. Restrict test traffic to the loopback fixture/app plus necessary local assets, record unauthorized egress attempts and fail if any real financial mutation escapes. The explicit contract revision binds wallet/history fixture shapes; it cannot manufacture a Payment HTTP contract from Prisma.

Record T054.wallet separately for V01..V06 and the Wallet parts of V24/V26/V29; T054.history for owner/precision and V19..V23 plus History parts of V24/V26/V29. T055 covers V07..V18 and relevant V22/V25/V26/V29 model scenarios, including intent-to-status coordination. Capture 320/375/430 widths, request/intent counters and page errors per scope/source revision. Output under ignored `.expo/wallet-validation`; reference observed results from future `validation.md`. A Wallet checkpoint may pass while History is NOT_RUN. Keep a cross-capability task unchecked until all its required scopes pass; downstream Wallet acceptance uses the named Wallet checkpoint, not a fabricated full-task pass.

QR renderer gate at the payment stage: inventory finds existing `react-native-svg` but no declared/installed QR encoder. Select and validate a local native/web-compatible encoder/renderer then; planning selects/installs none. Encode the exact synthetic raw `qrCode` payload locally, preserve quiet zone/contrast/integer modules at target widths, and independently decode the rendered QR back to the exact input. Missing/dense/unsupported/render-error cases keep known payment/status access. Never treat raw payload as image URI, XML, hosted URL or remote-service request; do not log real QR data. The approved QR-only flow needs no browser/WebView or return/cancel screen. Saving/sharing QR and bank-app opening require separate product scope rather than being implied validation steps.

## 5. Real owner API — after applicable gates close

Prerequisites: approved running API, recorded source/contract version, isolated A/B/Z test accounts, known safe records and an explicitly configured test base URL using existing local environment conventions. Wallet routes are recorded in [wallet-http.md](contracts/wallet-http.md); verify deployed readiness separately. Do not guess public Payment URLs/readiness from proposed backend documentation.

Execute the V27 read subsets independently once their mobile adapters and current-revision checks exist:

| Checkpoint   | Required mobile evidence                                           | Environment/data                                                                                                              | Expected real read evidence                                                                                                             |
| ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T057.wallet  | T019, T054.wallet and T056.wallet on the current source revision   | Approved A/B/Z plus an absent-wallet owner; matching BE contract and migration readiness                                      | Exact DTO/Credit strings, authorized virtual zero/version0 without init/bonus, session ownership, stale/read refresh and Home coherence |
| T057.history | T031, T054.history and T056.history on the current source revision | Approved owner/other-owner IDs, 200 safe ledger records, controlled append activity or evidence provided by the backend owner | Owner detail404, limit20, type/referenceType AND, sequence snapshot/continuations, new append visible only after fresh-chain refresh    |

T057.wallet does not wait for T031 or a real 200-record History dataset. T057.history does not require Wallet UI or payment creation. Record each result separately; missing environment blocks only the affected scope. Owner Payment status now has an actual API; its mobile adapter/tests and scoped integration remain future. Known-ID owner GET can be integrated independently of US2, QR rendering and durable create; no route amount or existing intent is required. Source/backend-test-only claims do not close mobile live acceptance; do not seed, migrate or modify backend files to manufacture test records.

### 5.1 T095: real owner status and PAID-dependent refresh

Run only after the owner-read integration/current source checks and approved read environment exist. BE/QA supplies an existing owner PAID UUID, a nonowner UUID and expected Wallet/History snapshots. This read-only scope needs no mobile create, QR renderer, merchant payment or GAP-06 recovery decision.

1. Open the approved known-ID status entry as its owner, with request counters enabled and no fixture response substitution. Confirm the exact authorized Payment projection/ID/version and PAID outcome.
2. Observe the shared authenticated GETs for `/me/wallet` and `/me/wallet/transactions`. Check accepted responses belong to the same current session and that History retains its existing filter/snapshot-chain rules.
3. Verify Home and Wallet use the same returned Wallet projection and exact Available/Held values. Verify History displays the supplied backend records after refresh. Compare with backend snapshots; do not calculate Credit from Payment, sum pages or manufacture a TOP_UP.
4. Record `V16/A.refresh-success`: Payment read and dependent GET counters, source/contract revision, redacted dataset references, expected/observed snapshots and independent read outcomes. Missing PAID/data/environment leaves this subcase BLOCKED; a basic owner-GET result alone does not pass it.
5. For `V16/A.refresh-fault`, use only BE-provided controlled failure scenarios: one dependent read fails, then the inverse, both fail/stale where supplied. PAID remains confirmed, each freshness/error notice is independent, and retry repeats GETs only. If failures are injected/intercepted on mobile or served by a loopback fixture, classify that evidence C/W and leave the A fault subcase BLOCKED/NOT_RUN.

Record successful owner read, PAID refresh and fault subcases separately under T095. Do not tick the parent task or the full V16/A scope until its required/selected criteria are met. Optional discovery keeps its own acceptance; it does not block known-ID status or inherit a PASS from it.

## 6. payOS QR/channel and backend evidence — separately prepared

Prerequisites: implemented public creation/status/recovery, approved payOS test/channel environment and credentials outside public app config, replay/recovery evidence, locally verified renderer and backend verification/atomic-posting evidence. Create/owner query/receipt/posting source is now implemented; GAP-06 retention/correlation, QR-01 and approved environment evidence are still required. Do not invent a sandbox hostname/flag or use production money as a substitute for an approved test environment. Server-side HTTPS return/cancel settings do not require mobile return/cancel pages or determine payment success.

For V28, perform explicit approved QR top-up/recovery scenarios and collect backend-owned proof for duplicate/out-of-order callbacks, authenticity checks, one verified TOP_UP and atomic PAID/wallet posting. Mobile evidence records returned identity/observations and request/intent counts; a rendered QR, descriptor `providerStatus` or success screen cannot prove Payment state, storage atomicity or deduplication. If prerequisites are absent, leave G evidence blocked and real continuation disabled.

### 6.1 Operational QA runbook — required before T096/T097 and native financial checks

**Current status: environment reported available; executable binding/evidence UNVERIFIED.** The tasks update and this remediation define prerequisites only. No executable financial QA binding, approved build/channel or financial authorization is supplied by these documents. The T053 runner remains model/Wallet-History-fixture only; it cannot silently become a live Payment runner, and synthetic preview must keep its no-egress/account-cache boundary.

**Producer**: Mobile maintainer + QA populate and verify this runbook under T096 before any financial API execution. The backend owner supplies deployed-contract/migration/provenance readiness, safe records and approved provider/channel configuration. An authorized environment/channel owner records the allowed test scope. T097 consumes the channel runbook; T098.financial/T099.financial require their platform-specific executable binding. Status-only read and synthetic/native QR checkpoints keep their separate prerequisites.

| Required field               | Owner / required proof                                                                                                                                                           | Current value                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Build and source             | Mobile/QA: app build identifier, source/contract SHA, platform/runtime and current T094 checks                                                                                   | UNVERIFIED: actual matching QA build not recorded here                                |
| Executable entry             | Mobile/QA: T078 read entry / T085 financial entry producer, exact verified invocation/manual steps and mounted shared authenticated adapter/UI (plan private QA entry ownership) | SOURCE_READY T078/T085 private mount; actual native build/invocation UNVERIFIED       |
| Authentication and isolation | Mobile/QA: approved owner A/B test accounts, current-session binding, cleanup and separate test context; credentials obtained outside committed docs/public configuration        | UNVERIFIED: no bound A/B session evidence in this run                                 |
| Backend environment          | Backend owner: approved API environment, matching migration/config/provenance, known records and safe expected projections                                                       | BLOCKED: not verified                                                                 |
| Provider mode/channel        | Backend/channel owner: explicitly approved mode/channel and supported scan workflow; identify whether the provider is stubbed or real                                            | BLOCKED: no merchant/sandbox assumption                                               |
| Allowed actions              | Authorized owner/QA: approved create/replay/check/scan/interruption cases, safe data and operational bounds; distinguish API-only from native UI journeys                        | BLOCKED: no approved execution scope                                                  |
| Recovery prerequisites       | Mobile/BE/QA: accepted T079/T080 policy, retained key/body/ID handling and stop behavior on unknown result; no automatic new intent                                              | T079/T080 contract + source complete; actual deployment/store/native evidence pending |
| QR readiness                 | Mobile/QA: reviewed encoder/decoder, T093 evidence and the applicable QR-01/device/workflow gates                                                                                | T089..T093 source/W complete; applicable native/channel QR-01 gates unverified        |
| Observability                | QA + BE: safe output location, request/intent/posting counters, independent Wallet/History refresh results and backend-owned receipt/posting evidence                            | BLOCKED: no observed run                                                              |
| Run record                   | QA: owner/date/build/environment/scope, expected and observed outcomes, interruption/cleanup steps and stop conditions                                                           | NOT_RUN                                                                               |

Before executing, every field needed by the selected scope must have an actual value and evidence. Keep production Confirm/mutation defaults disabled. A direct authorized adapter/API run may establish A contract behavior; it cannot establish a native top-up UI journey. A disabled Confirm, model interaction, mocked provider, backend-only proof or memory remount cannot pass native financial/merchant/restart acceptance.

Missing source entry/build-selection/mount code is unfinished T078 (read) or T085 (financial): implement the private QA targets/tests assigned in plan.md under a later authorized implementation request, without asking D4 design approval again. Existing approved source scope includes app.config.ts, thin _layout mount, src/qa/payment-qa-entry.tsx and narrow feature public exports; normal app/production/preview remain unchanged and unavailable for financial QA. Missing actual built entry/config/auth/actions keeps T095/T096/T097 or native evidence GATED even after those source tasks pass. Only work outside the listed approved scope requires a scope decision. This docs remediation creates no source/command, capability activation or permission for financial calls. Missing Android/iOS binding blocks the matching checkpoint, not independent status source work.

## 7. Android and iOS — separately recorded

Using a compatible device/development client per README, run the applicable fake/approved scope. Wallet requires T019/T056.wallet, History requires T031/T056.history; neither waits for the other or Payment preparation. Intent/QR-shell model checks require T041, status-model checks require T050, and their combined navigation checks need both. Scope the relevant V01/V06/V08/V12..V14/V17/V24/V25/V29/V30 observations accordingly: keyboard, large text/screen reader, native Back, close/reopen, background/foreground, connectivity loss and owner/session replacement. Production QR decoding, payment/restart recovery and real outcome checks remain gated by QR-01, GAP-06 recovery decisions, mobile wire integration and T058/approved channel evidence. A manual return from another app never authorizes creation or a local payment result.

Record Android and iOS results independently, with Wallet/History/model subresults and exact NOT_RUN/BLOCKED prerequisites. Wallet-only device evidence does not pass full T059/T060 or SC-007. On this Windows host, local iOS simulator execution is unavailable; obtain an appropriate device/environment separately. A web export or native bundle export does not satisfy either device acceptance. No remote/paid simulator is provisioned by this plan.

## 8. Acceptance record

For each run, record case/layer, source/contract version, environment, prerequisites, safe dataset IDs, commands/manual actions, expected/observed result, status and evidence path. Trace SC-001..007 using the matrix. Stop on false success, duplicate intent/posting, precision loss or other-owner disclosure; preserve independently valid evidence and the exact remaining gate.

T061/T062 can hand off a partial increment with current source checks and honest observed/blocked records. Claim Wallet A only after T057.wallet; claim History A only after T057.history. Missing channel/native evidence remains visible and prevents full financial/platform acceptance, not the writing of a truthful increment report.

Do not run Spec Kit commands or financial operations merely by following this guide. The tasks update maps plan I1..I6 to38 new unchecked tasks T063..T100.100 tasks now exist with the original62 IDs and49 completion markers preserved. A later explicitly scoped implementation invocation must follow their entry gates.

## Private QA source invocation contract — T078/T085 ready, operational run still gated

The existing Expo entry and AppProviders stay in use. app.config.ts preserves app.json ordinary configuration and emits extra.paymentQa only when the explicit internal QA inputs are supplied; EAS_BUILD_PROFILE=production denies it. src/app/_layout.tsx mounts src/qa/payment-qa-entry.tsx. It matches native platform, normalized API environment, authenticated owner and Constants.nativeBuildVersion before choosing a read host or lazy financial host. No URL can select QA; web/preview and missing/mismatched metadata deny the binding. Normal Payment/Confirm remains off.

| Build input                      | Required meaning (public labels, never credentials)                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| SKILLHUB_PAYMENT_QA_DISTRIBUTION | internal only; this label is not release/action authorization.                                                                          |
| SKILLHUB_PAYMENT_QA_MODE         | read for GET-only owner QA; financial only for specifically allowed create/replay scope.                                                |
| SKILLHUB_PAYMENT_QA_ENV          | Exact normalized API URL matching EXPO_PUBLIC_API_URL and the approved deployment.                                                      |
| SKILLHUB_PAYMENT_QA_BUILD        | Exact actual native build-version string; not a fabricated label, web export hash or Expo Go assumption.                                |
| SKILLHUB_PAYMENT_QA_OWNER        | Approved authenticated QA owner ID, no token/password. A/B must bind independently.                                                     |
| SKILLHUB_PAYMENT_QA_ACTIONS      | Comma-separated read; financial additionally requires create,replay. This source allowlist does not grant permission to transfer money. |

Mobile/QA must fill section6.1 with the actual artifact, invocation/login steps, deployment/migrations, channel, allowed actions/amount and evidence owners before T095/T096. Environment existence was user-confirmed; values, binaries, accounts/channel permissions and outcomes remain UNVERIFIED here. No financial binding was activated in this run. Source-producing code is complete within the approved D4 scope; do not ask D2–D4 again.

Source checkpoint commands are now runnable from apps/mobile: the policy/read-QA/QA-entry, create/durable-recovery and create-UI/QA-host files listed at the top all exist. Final source command used: node node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts test/profile.test.mjs, plus installed ESLint/TypeScript/check-structure. Platform JS import checks used expo export --platform all --no-bytecode; these are not binaries or native execution. Repeat only affected/full checks when new changes/failures justify it. Current ignored W runner and reports live under .expo/wallet-completion; they are synthetic source evidence, not a tracked T053 financial harness.
