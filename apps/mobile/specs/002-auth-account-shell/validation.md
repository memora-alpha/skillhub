# Validation: mobile auth and account shell

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

The test command runs 38 HTTP/session, form-validation and recovery tests through
`tsx` and `node:test`. Committed provider, screen and auth/account integration
tests are not yet implemented.

## Required integration evidence

- Registration returns neutral `202`, then valid OTP verifies with `204`.
- Login returns tokens and `GET /me` populates the signed-in shell.
- Cold start rotates one stored refresh token and replaces it securely.
- Concurrent protected requests issue only one refresh request.
- Invalid refresh resolves to guest and removes local credentials.
- Offline bootstrap preserves the stored token and offers retry.
- Current logout and logout-all both clear local state.
- Forgot/reset preserves neutral responses and does not auto-login.
- No password, OTP, refresh token or Authorization value appears in logs.

## Current status

Source and task review completed on 2026-10-08. Auth/account runtime code exists;
the feature is not acceptance-complete. The checklist distinguishes implemented
code from missing hardening and integration evidence.

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

All four commands above were rerun successfully on 2026-10-08:

- TypeScript: passed.
- ESLint: passed with no warnings.
- Structure check: passed for 142 source files using the scoped AGENTS limits.
- Unit tests: 38 passed, 0 failed.

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

## Open hardening findings

- A mock-only review reproduction confirmed that a PATCH started under account
  A can be retried under account B when A's delayed response is 401. The HTTP
  layer does not bind retry/expiration to the original session generation.
  Checking generation after the mutation response cannot undo a server write.
- Logout-all calls the protected endpoint but its screen does not handle
  pending state or rejected promises.
- Account queries/profile mutations remain in the auth context instead of the
  planned account hooks. The plan now records actual Axios/form/recovery choices;
  README/API status descriptions still contain obsolete demo-only statements.

## Acceptance evidence still required

- Run registration, verification/resend, login and forgot/reset with a local API.
- Run native cold-start, SecureStore persistence/deletion, expired/rejected
  refresh, current logout and logout-all paths on Android/iOS.
- Add storage, Query/provider, screen and auth/account integration coverage,
  including the account-switch retry race.
- Reconcile the spec's offline-bootstrap retry expectation with the strict
  rotation implementation: an ambiguous refresh response currently retains the
  in-flight marker and requires reauthentication rather than replaying a token.
- Fix the open hardening findings and record the final acceptance results.

The initial task check changed only documentation. The subsequent form UX
follow-up changed mobile runtime, tests and dependency lockfiles. No backend
changes were made.
