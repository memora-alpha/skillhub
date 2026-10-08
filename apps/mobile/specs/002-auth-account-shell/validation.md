# Validation: mobile auth and account shell

## Session boundary and logout-all fixes (2026-10-09)

- Resolved both blockers from the readiness review below. Protected HTTP calls
  capture the bound transport and session generation before reading a token.
  They check it after async token reads, renewal and responses, before retry or
  expiration. A request started under A never replays using B's credentials or
  expires B's session; stale successful results are also rejected.
- Logout-all uses the shared mutation/toast feedback with no automatic retry.
  The action and Back button are disabled while pending. The controller deduplicates
  concurrent requests in the same session and rejects late success after an
  account switch. Network/server failures retain the session for explicit retry.
- Typecheck, lint, structure and all 55 mobile tests passed. Added nine HTTP
  boundary cases and three logout-all controller cases, including delayed first
  and retry responses, pending token reads/renewal, account switching, duplicate
  calls, success, failure and manual retry. Same-session renewal still works.
- Playwright/Edge at 390×844 with all API calls mocked passed pending guards,
  one toast after 503 or transport failure, session retention, manual retries and
  guest navigation after bodyless 204. No unhandled promise/page errors occurred.
- Mobile-only changes; no backend, dependency or environment changes. Native
  SecureStore/device behavior and real mailbox acceptance remain unverified.

## Commit and dev readiness review (2026-10-09)

- Updated `origin/dev`; it is an ancestor of this feature branch (0 behind,
  15 ahead at review). No unmerged paths or tracked environment files found.
- Typecheck, lint, structure and all 43 mobile tests passed. Registration and
  recovery browser checks passed again with all API requests mocked.
- Fixed formatting in four changed mobile files to match the Prettier Git hook.
- Local BE now exposes `password/verify-otp` and resetToken-based reset in Swagger;
  PostgreSQL, MongoDB and Redis readiness passes.
- **Pre-fix finding, resolved above:** a fresh mock adapter reproduction confirmed
  the existing account-switch retry finding: a PATCH started under A receives a
  delayed 401 and is replayed with B's token. `src/lib/http/client.ts` must bind
  retry and expiration to the original session generation before any replay.
- **Pre-fix finding, resolved above:** `AccountSettingsScreen.tsx` discarded the logout-all promise without a
  rejection handler or pending guard. Offline/server failures produce no useful
  feedback, and repeated taps can issue concurrent logout-all requests.
- Real mailbox journeys and native SecureStore/cold-start checks remain pending.

## Recovery token alignment (2026-10-09)

- Mobile now calls `/auth/password/verify-otp` before opening the new-password
  screen and sends its `resetToken` to `/auth/password/reset`. Email and reset
  proof stay in memory; the OTP is not retained after verification.
- Removed the new-password action to re-enter the consumed OTP. Invalid or
  expired reset authorization restarts at the email step with email retained.
  OTP failures stay on code entry with one toast; reset network/5xx failures
  retain password input and suggest trying the new password at login.
- `npm run check-types`, `npm run lint`, `npm run check-structure` and
  `npm test` passed (43 tests; 143 source files within configured limits).
- Playwright/Edge at 390×844 passed mocked forgot → wrong OTP → resend →
  verified OTP → password form without code actions → 503 with retained input →
  retry 204 → login. Rejected reset tokens restart at forgot with email retained;
  a direct new-password link without in-memory proof also returns to forgot.
  Verified request bodies, leading-zero OTP, no Bearer tokens, no automatic
  login/retry, secret-free route parameters and no browser runtime errors.
- Screenshot: `reset-password-no-code-390.png` in the task artifact directory.
  These are mock API checks, not a real mailbox/password-reset journey. Native
  device verification remains pending; the updated backend now runs locally.

## Planning baseline

The following describes the initial planning state, not the current runtime.

- Branch created from `origin/dev` at `da3de45`.
- Current auth UI uses local `MockSessionProvider` state.
- Mobile has no HTTP client, secure credential store or TanStack Query provider.
- Backend identity v1 exposes the required register, verify, login, refresh,
  logout, logout-all, forgot/reset and own-account endpoints.
- Google OAuth, email change and session-management endpoints are not in the
  approved v1 contract.

## Required automated checks

```powershell
pnpm --filter mobile check-types
pnpm --filter mobile lint
pnpm --filter mobile check-structure
pnpm --filter mobile test
```

The test command runs 55 HTTP/session, form-validation and recovery tests through
`tsx` and `node:test`. Committed provider, screen and auth/account integration
tests are not yet implemented.

## Required integration evidence

- Registration returns neutral `202`, then valid OTP verifies with `204`.
- Login returns tokens and `GET /me` populates the signed-in shell.
- Cold start rotates one stored refresh token and replaces it securely.
- Concurrent protected requests issue only one refresh request.
- Invalid refresh resolves to guest and removes local credentials.
- Bootstrap failures before refresh submission offer retry; an uncertain rotation
  result requires reauthentication without replaying the stored credential.
- Current logout and logout-all both clear local state.
- Forgot/reset preserves neutral responses and does not auto-login.
- No password, OTP, refresh token or Authorization value appears in logs.

## Current status

Source and task review completed on 2026-10-09. This mobile increment is ready
for development integration; full feature acceptance still needs real mailbox,
provider/storage and native-device evidence. The checklist distinguishes these
gaps from the implemented and regression-tested behavior.

## Source evidence

- `src/lib/http/client.ts`: shared Axios transport, bearer auth, normalized
  errors and one protected-request retry. Axios replaced the original fetch
  decision at the user's request.
- `src/config/env.ts`: validates `EXPO_PUBLIC_API_URL` and versioned API path.
- `src/lib/storage/auth-token-store.ts`: native Expo SecureStore adapter;
  browser preview intentionally uses memory-only credentials.
- `src/features/auth/context/session-controller.ts`: in-memory access token,
  serialized refresh, persisted rotation marker, bootstrap and logout actions.
- `src/providers/QueryProvider.tsx` and `AppProviders.tsx`: one QueryClient and
  the active AuthSession provider, followed by the session gate.
- `src/features/auth/context/AuthSession.tsx`: `GET /me` query, session-scoped
  key, cached account projection and profile mutation/cache invalidation.
- `src/features/auth/api/` and `src/features/account/api/`: typed v1 adapters.
- `src/features/auth/hooks/use-auth-actions.ts` and auth screens: real auth
  mutations, neutral acknowledgments and navigation back to login.
- `src/features/auth/schemas/auth-schemas.ts` and
  `src/features/account/schemas/profile-schema.ts`: React Hook Form/Zod form
  validation used by auth and editable profile screens.
- `src/features/auth/components/AuthNavigator.tsx`: protected signed-in routes.
- Shell and profile consumers use `useAuthSession`; the legacy `MockSession`
  implementation is not wired into the app but has not been deleted.

## Automated checks

All four commands above were rerun successfully on 2026-10-09:

- TypeScript: passed.
- ESLint: passed with no warnings.
- Structure check: passed for 143 source files using the scoped AGENTS limits.
- Unit tests: 55 passed, 0 failed.

The tests cover one 401 retry, malformed success envelope, concurrent refresh,
ambiguous refresh recovery and logout winning over a late login response. Form
tests cover first-blur validation, error clearing on correction, invalid submit
blocking, touched confirmation revalidation, field-specific error messages and
unchanged valid-input boundaries. They do not establish native
SecureStore behavior, full Query/provider lifecycle or end-to-end API correctness.

## Form UX follow-up

- Auth and edit-profile forms validate after the first blur, then on changes;
  submit still validates untouched fields. Controlled inputs forward their
  native refs for error focus and next-field actions.
- `react-native-toast-message` renders one root-level toast. API errors and
  neutral/success acknowledgments replace the current toast instead of adding
  inline banners. Toasts expire, support dismissal and hide from accessibility
  when no longer visible. Styling uses existing theme tokens.
- `react-native-keyboard-controller` provides native keyboard-aware form
  scrolling; web retains a regular ScrollView. Native forms no longer re-center
  when the keyboard changes the available height. Helper-message space and
  password requirements remain stable during typing.
- Edit-profile fields and cancellation are guarded during save. Failed saves
  retain the draft; successful saves immediately return with a toast, without
  a delayed redirect that could discard later edits.
- Headless Playwright checks passed against an isolated Expo web preview on
  2026-10-08, with all API calls intercepted: blur/correction validation,
  next-field and invalid-submit focus, invalid requests blocked, OTP filtering,
  toast replacement/dismissal/expiry and navigation feedback. A mocked profile
  flow checked pending guards, failed-save draft retention and success/cache
  navigation. Mobile (390 x 844) and desktop (1280 x 900) screenshots were
  inspected; no page errors were observed. This is not real API acceptance.
- Keyboard movement and dismissal still need Android/iOS device verification.
  A custom development build must include the new keyboard native dependency.
- Verification email is read-only; verify and resend use the original normalized
  route email. Missing/invalid route email returns to login. A browser-only mock
  check confirmed both payloads and successful return to the same login email.
- Auth layout/copy refinements were checked at 320, 390 and 1280 px widths:
  compact password requirements, readable empty/format/length errors, OTP input,
  read-only email appearance and reachable registration actions. The profile
  editor uses a constrained desktop width and name/title/bio focus order. Its
  mocked save-error/retry flow remained successful. No backend or API rules
  were changed in this refinement.

## Verification input and resend cooldown

- Email verification uses six aligned cells backed by one accessible native
  TextInput, preserving paste, deletion, six-digit filtering and OS autofill hints.
  Email stays read-only and validation still starts on blur or submit.
- Registration acknowledgments and resend attempts start a 60-second client
  cooldown per normalized email. Resend is reserved synchronously before the
  request, including failed requests, to prevent repeated taps. Acknowledgments
  extend the wait from response time. In-memory timestamps survive navigation;
  elapsed time is recalculated after backgrounding rather than decrementing ticks.
- The existing API independently limits OTP issuance to one per 60 seconds and
  five per clock-hour. Neutral 202 acknowledgments remain unchanged and are not
  delivery guarantees. App restarts clear client timestamps; backend protection
  remains authoritative. No backend source was changed.
- Four focused cooldown unit tests were added. Web mock checks on 2026-10-08
  passed at 320/390/1280 px: initial wait, exact expiry, resend error/recovery,
  SPA navigation retention, paste/deletion/filtering, blur validation, and verify
  failure/success. All API calls were intercepted; no real emails were sent.
- Native keyboard/autofill and Android/iOS background behavior still require
  device verification.

## Three-screen recovery UI

- Recovery now has separate email, code-entry and new-password screens. The
  OTP screen reuses OtpInput, AuthLayout, Button and the 60-second cooldown hook.
  Recovery and registration cooldown stores are separate, matching OTP purposes.
- A feature-owned, non-persisted Zustand draft carries the normalized email and
  code. No code appears in route params. Missing draft redirects to email entry;
  missing code redirects to code entry. Starting another recovery, succeeding or
  leaving the recovery routes clears the appropriate draft state.
- The code screen only validates format and uses a Continue action; it makes no
  verification call and does not claim the code has been server-verified. The
  existing password/reset endpoint still receives all four fields. Standalone
  recovery verification is a documented backend TODO, explicitly deferred.
- Five recovery state/schema tests and one purpose-isolation cooldown test were
  added; the mobile suite passes 38 tests. TypeScript, lint and structure checks
  pass; all 142 source files remain within configured limits.
- Headless browser checks with intercepted APIs passed at 320/390/1280 px:
  three distinct screens, read-only email, OTP/confirmation validation,
  neutral send/resend, cooldown/error/retry, missing-draft gates, invalid OTP
  return, password draft retention on server failure, pending guards and success
  return to login. Registration OTP regression checks also pass. No real emails
  were sent and no real account password was changed.
- Native keyboard, autofill and device navigation remain unverified.

## Redis OTP alignment — 2026-10-08

- Long OTP guidance blocks were removed. Invalid-code feedback briefly mentions
  the conditional five-wrong-code/24-hour restriction. Registration still offers
  register-again with the email prefilled.
- Request/resend feedback asks users to check email without claiming delivery.
  Existing 60-second per-purpose cooldowns and public API payloads remain intact.
- An actual reset OTP rejection preserves the email and an inline rejection
  notice on returning to code entry. No local error counter or ban timestamp is
  inferred from the generic API error. Ordinary password login remains available.
- Reset network/5xx failures preserve password input and briefly suggest trying
  the new password at login, with an email-prefilled login link.
- `npm run check-types`, `npm run lint`, `npm run check-structure` and `npm test`
  pass. There are 143 source files within the configured limits and 43 passing
  tests, including five new API/recovery regression cases using an Axios adapter.
- New checks cover public forgot/resend requests, leading-zero OTP payloads,
  bodyless `204`, no automatic retry/resend, retained rejection state and
  ambiguous reset outcomes. No real emails were sent or passwords changed.
- Visual/native device verification for this alignment remains pending.
  Backend source and dependency/lock files were not modified.

## Toast appearance refresh — 2026-10-08

- Updated the shared `src/components/Toast.tsx` and centralized its appearance in
  `src/constants/theme.ts`. The light overlay uses rounded corners, a subtle
  shadow, tinted success/error/info icons and Nunito text without extra headings.
- Width follows the viewport with 16px side margins and a 448px cap. Text wraps;
  the close button retains a 44px target and visible pressed feedback.
- Browser checks on the running mobile preview passed at 390px and 320px:
  success/error screenshots, dismissal, error expiry and no runtime errors.
  The error response was intercepted in the browser; no real login/reset was sent.
- Typecheck, lint, structure (143 source files) and all 43 tests passed.
  Native-device rendering remains unverified; toast timings, safe-area placement
  and reduced-motion behavior retain the existing provider configuration.

## Verification back link — 2026-10-08

- Replaced the registration-expiry button in `VerifyEmailScreen.tsx` with a
  plain "Quay lại đăng ký" link. It retains the email and disables during requests.
- Browser preview at 390px passed: link appearance, 44px target, navigation to
  registration with email prefilled and no runtime errors. No API was sent.
- Typecheck, lint, structure and all 43 tests passed. Native-device verification
  remains pending.

## Registration API audit — 2026-10-09

- Source and live Swagger confirm registration `202`, registration resend `202`,
  verification `204`, login `200` and protected `/me` are connected in mobile.
  The local API URL matches the current Wi-Fi address.
- Browser checks exercised the real screens with intercepted API responses:
  registration `503` stays on the form, `202` opens verification, cooldown blocks
  early resend, OTP `400` stays on verification, resend clears the old code,
  leading-zero OTP `204` opens login exactly once, and login/`me` opens home.
- Request bodies, JSON headers and token boundaries matched the contracts.
  No password was put in route params; no runtime errors or automatic OTP retry
  were observed. All API responses in this browser check were mocked, so SMTP,
  Redis verification and account creation with a real emailed OTP remain untested.
- No mobile implementation or backend changes were needed for this audit.
- Live CORS preflight for the mobile web origin `http://localhost:8081` returned
  `Access-Control-Allow-Origin: http://localhost:3000`. Browser requests from
  the mobile preview are therefore blocked despite reachable backend Swagger.
  Native requests do not use browser CORS. Backend configuration was not changed.

## Verification error feedback — 2026-10-09

- Removed the duplicate inline API-error banner from `VerifyEmailScreen.tsx`.
  OTP rejection now uses only the shared toast; field-format validation remains
  attached to the OTP input.
- Browser check confirmed exactly one OTP-error alert, no verification redirect
  after `400`, and login after `204`. Screenshot was reviewed at 390px.
  API responses were mocked; no real account or email was created.
- Typecheck, lint, structure and all 43 tests passed. Native-device verification
  remains pending.

## Hardening status

- The account-switch retry and logout-all pending/error findings were resolved
  in the 2026-10-09 follow-up above, with repository regression tests and
  mocked browser checks.
- Account queries/profile mutations remain in the auth context instead of the
  planned account hooks. The plan now records actual Axios/form/recovery choices;
  README/API descriptions now reflect real auth and the published recovery contract.

## Acceptance evidence still required

- Run registration, verification/resend, login and forgot/reset with a local API.
- Run native cold-start, SecureStore persistence/deletion, expired/rejected
  refresh, current logout and logout-all paths on Android/iOS.
- Add storage, Query/provider, screen and auth/account integration coverage.
  Account-switch HTTP/controller regressions are already covered by repository tests.
- Record the remaining live/native acceptance results. The spec now matches
  strict rotation: uncertain refresh outcomes require reauthentication.

The initial task check changed only documentation. The subsequent form UX
follow-up changed mobile runtime, tests and dependency lockfiles. No backend
changes were made.
