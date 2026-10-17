# Validation quickstart

**Current state (2026-10-17)**: [Validation](validation.md) records T001..T041 and T044..T051 complete within scoped criteria; P4/P5 are preparation only. T042/T043/T052..T062 stay unchecked. Normal status/Confirm and all Payment capabilities remain unavailable; owner reads/P4 behavior are unchanged. P5's four test files now exist; tracked T053 runner still does not. Source baseline remains17e3ac1 without drift. L/W models do not establish Payment C/A/G, QR decode/recovery or native acceptance.

## 1. Verify workspace and inputs

From the repository root:

```powershell
git branch --show-current
git status --short
```

Expected branch: `feat/mobile-wallet-payment-history`. Keep other work and the existing Git index intact. Read [plan.md](plan.md), actual [wallet HTTP contract](contracts/wallet-http.md), [integration gates](contracts/integration-gates.md), [UI flows](contracts/ui-flows.md), [recovery contract](contracts/payment-recovery.md) and [validation matrix](validation-matrix.md).

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

Installed-binary fallback is `node node_modules/tsx/dist/cli.mjs --test ...` from `apps/mobile`. Full focused checks now run `tests/wallet*.test.ts`:86/86; full mobile382/382,zero fail/skip. P5 source checks/export and8 task-level W groups pass; `.expo/wallet-p5-validation` is ignored evidence, not a tracked T053 runner or T055 combined scenario. Normal route never configures a reader, reads URL outcomes or adopts a preview ID. Conflicting observations keep the previous result stale because no freshness contract exists; no enum-order transition is inferred. No API/channel/native/restart acceptance follows from these model results.

### Cross-story regression

After both T041 and T050, T055 checks combined intent-to-status model navigation and session cleanup through the browser harness. Each story's own tests above remains runnable independently. When the applicable source increment is ready, run the existing full suite for regression:

```powershell
pnpm --filter mobile test
```

Only files actually added at that point are included by the suite. Existing unrelated tests passing does not prove new Wallet behavior. Use controlled promises/request counters for races. Payment C/A/G acceptance remains blocked until implemented operational contracts and separate activation evidence exist.

## 4. Isolated web preview — after P1/P2–P5 as applicable

Start the existing web preview from repository root:

```powershell
pnpm --filter mobile web
```

For a static bundle check when needed:

```powershell
pnpm --filter mobile exec expo export --platform web --output-dir .expo/wallet-preview
```

Use the explicit wallet model-preview host for proposed Payment/QR states. A tracked fake-owner loopback fixture can serve the actual wallet/history HTTP shape from [wallet-http.md](contracts/wallet-http.md); Payment HTTP fixture mode must wait for implemented public contracts. Never point fixture scenarios at a real gateway or use `.env` production data. Keep environment overrides process-local/ignored, not committed public configuration.

The proposed `scripts/wallet-browser-validation.mjs` must own a reproducible harness interface: explicit app URL, `--mode model|http-fixture`, `--scope wallet|history|payment-model`, output directory and externally supplied browser-automation module path/runtime. HTTP-fixture mode requires an explicit confirmed contract revision; payment-model scope permits model mode only. These are planned CLI options for T053, not an existing runner. Do not hardcode a developer's cache path. Existing ignored `.expo` scripts are examples only. Browser automation library/browser version and availability must be recorded; if unavailable, record manual scripted results with the same case/scope IDs rather than claim automation ran. No new test dependency is installed during documentation work.

After T053 implements that interface and the browser module is explicitly configured, run only the implemented scope from `apps/mobile`. The Wallet command needs T019; it does not need History UI, real History records or payment preparation:

```powershell
node scripts/wallet-browser-validation.mjs --url http://127.0.0.1:8081 --mode http-fixture --scope wallet --contract 17e3ac1 --browser-module "$env:WALLET_BROWSER_MODULE" --output .expo/wallet-validation/wallet
```

After T031, History can run independently with its own 200-entry fixture dataset:

```powershell
node scripts/wallet-browser-validation.mjs --url http://127.0.0.1:8081 --mode http-fixture --scope history --contract 17e3ac1 --browser-module "$env:WALLET_BROWSER_MODULE" --output .expo/wallet-validation/history
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

T057.wallet does not wait for T031 or a real 200-record History dataset. T057.history does not require Wallet UI or payment creation. Record each result separately; missing environment blocks only the affected scope. Payment status remains BLOCKED until an actual owner Payment API exists and a later approved plan/tasks update permits integration. Source/backend-test-only claims do not close mobile live acceptance; do not seed, migrate or modify backend files to manufacture test records.

## 6. payOS QR/channel and backend evidence — separately prepared

Prerequisites: implemented public creation/status/recovery, approved payOS test/channel environment and credentials outside public app config, replay/recovery evidence, locally verified renderer and backend verification/atomic-posting evidence. Provider/amount selection is known, but protocol helpers alone do not satisfy these prerequisites. Do not invent a sandbox hostname/flag or use production money as a substitute for an approved test environment. Server-side HTTPS return/cancel settings do not require mobile return/cancel pages or determine payment success.

For V28, perform explicit approved QR top-up/recovery scenarios and collect backend-owned proof for duplicate/out-of-order callbacks, authenticity checks, one verified TOP_UP and atomic PAID/wallet posting. Mobile evidence records returned identity/observations and request/intent counts; a rendered QR, descriptor `providerStatus` or success screen cannot prove Payment state, storage atomicity or deduplication. If prerequisites are absent, leave G evidence blocked and real continuation disabled.

## 7. Android and iOS — separately recorded

Using a compatible device/development client per README, run the applicable fake/approved scope. Wallet requires T019/T056.wallet, History requires T031/T056.history; neither waits for the other or Payment preparation. Intent/QR-shell model checks require T041, status-model checks require T050, and their combined navigation checks need both. Scope the relevant V01/V06/V08/V12..V14/V17/V24/V25/V29/V30 observations accordingly: keyboard, large text/screen reader, native Back, close/reopen, background/foreground, connectivity loss and owner/session replacement. Production QR decoding, payment/restart recovery and real outcome checks remain blocked by QR-01, operational APIs and T058/later scope approval. A manual return from another app never authorizes creation or a local payment result.

Record Android and iOS results independently, with Wallet/History/model subresults and exact NOT_RUN/BLOCKED prerequisites. Wallet-only device evidence does not pass full T059/T060 or SC-007. On this Windows host, local iOS simulator execution is unavailable; obtain an appropriate device/environment separately. A web export or native bundle export does not satisfy either device acceptance. No remote/paid simulator is provisioned by this plan.

## 8. Acceptance record

For each run, record case/layer, source/contract version, environment, prerequisites, safe dataset IDs, commands/manual actions, expected/observed result, status and evidence path. Trace SC-001..007 using the matrix. Stop on false success, duplicate intent/posting, precision loss or other-owner disclosure; preserve independently valid evidence and the exact remaining gate.

T061/T062 can hand off a partial increment with current source checks and honest observed/blocked records. Claim Wallet A only after T057.wallet; claim History A only after T057.history. Missing channel/native evidence remains visible and prevents full financial/platform acceptance, not the writing of a truthful increment report.

Do not run `$speckit-implement` or financial operations merely by following this guide. Tasks have already been generated; after this targeted remediation, the next review command is `$speckit-analyze`. Implementation still requires the user's separate instruction and the applicable gates.
