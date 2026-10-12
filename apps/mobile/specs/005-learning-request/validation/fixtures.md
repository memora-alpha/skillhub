# Fixture/web evidence — Spec 005

Checkpoint 2026-10-12, working tree `feat/mobile-learning-request`.
Only test-only loopback API4315 and Expo web8082; no real backend mutation.
Dataset: two fake users, each 25 own requests, canonical UUIDs, limit20 then5.
Browser: in-app browser, web viewport390x844. Native evidence remains Pending.

## Before recovery changes

- T001/T002: HTTP fixture returns distinct actors and two pages (automated).
- T003: Wrong ID from PATCH/publish/cancel reproduced three protocol failures
  missing in the old client. After T004, all five mutation fixture tests pass.
- T005: Profile shortcut opens Mine. Injected GET mine `cursor=true`503; previous
  20 cards remain. Failure/retry appear at header while footer still says
  “Xem thêm yêu cầu”, obscuring that only the next page failed. T006 corrects this;
  post-change verification will be recorded below.
- T007: Delayed submit reproduced frozen resolver clock, undefined slots and past
  custom expiry. T008 now checks submit time, returns field Zod errors and keeps
  untouched server timestamps; six new time tests + ten baseline LR tests pass.

This report records fixture behavior; it does not establish backend readiness,
Tag lookup, actual moderation/eligibility/ranking/lock or Android/iOS behavior.

## After implementation — 2026-10-12

All operations below used fake accounts/data on the loopback harness. The server
was restarted once after correcting the unknown-outcome simulation; request IDs
and counts are scoped to the scenario, not added across resets.

| Tasks      | Browser result / automated evidence                                                                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T005/T006  | Mine next-page503 retains20 cards, moves error/retry to footer; retry loads25. Automated network/503 cases also retain pages; load-more is blocked during refetch.                                                                                                                                                                                 |
| T009/T010  | Cached own detail GET404 hides body/reason/actions; subsequent503 remains unavailable until GET200. Cached public GET403 hides content. Five snapshot/read-guard tests cover own/public404/403, transient retention, reason cleared by successful edit, old generation and remount after denial.                                                   |
| T011..T013 | PATCH409 stays in editor with local description. GET503 keeps draft and Save blocked; GET200 shows changed goal beside baseline. Explicit Keep preserves edited description, adopts untouched goal/version, sends nothing until the next Save. Save succeeds and Back returns to Mine.                                                             |
| T013/T014  | In a second editor, GET403 after conflict hides all fields without unmounting draft. Delayed successful read disables Back/notification; comparison restores the local title. Explicit choice is still required.                                                                                                                                   |
| T014       | Create403 NEW_ACTIVITY_RESTRICTED and429 retain input with error; PATCH403 FORBIDDEN on B retains input and does not imply GET denial. ACCOUNT_NOT_ACTIVE on A expires shared Auth, removes editor/draft, returns to guest root. Subsequent login B opens B Mine/detail/editor with no A draft or success navigation.                              |
| T014       | Wrong-ID PATCH owner response causes protocol/unknown notice, stays in editor and locks Save. GET of the known ID shows the committed server snapshot for explicit comparison; no automatic resend, sync or success navigation. PATCH/publish/cancel wrong-ID guards are tested separately.                                                        |
| T014       | Unknown create after a partially delivered201 stays in New, locks Save and offers only explicit Mine navigation. Exactly one POST was recorded for this corrected scenario; no title lookup. Mine shows the committed draft after the user opens it.                                                                                               |
| T015/T016  | Open editor before a30-second deadline, edit title, wait past deadline, then Save: one preflight GET returns effectiveStatus EXPIRED, draft stays, PATCH count does not increase. Fake-clock tests separately cover expired direct-editor entry, changed version, read failures, clock skew, terminal and NEGOTIATING states.                      |
| T017..T020 | Close discards staged scope/Skill without request. Apply recommended+React produces two chips and13 peer cards. Clear Skill gives20+cursor. Changed matchingVersion invalidates next cursor;400 retains20, manual restart then next page reaches25. Recommended503 remains an error, without feed fallback. Reset/Apply explicitly switches scope. |
| T020       | Public peer detail uses owner/Skill/Tag projection and has no mock Proposal/profile action. Home mock card opens `/explore/requests/react` with explicit sample/guest copy; fixture event log is unchanged, so guest preview does not call LR. Own/peer identity and invalid UUID/resource ID are also covered by API tests/source route guards.   |
| T033/T034  | Profile->Mine(DRAFT filter)->New->Back->Mine keeps filter, Back->Profile. Discovery->New->save->detail->edit/save->detail->Back returns directly to Discovery, without repeated editor. Delayed create/PATCH with double click each record one app mutation.                                                                                       |

Pending Back initially had a no-op handler but exposed an enabled button on web.
The shared AppHeader now receives optional navigationBlocked from AppScreenLayout;
Back/owned header controls expose disabled state during read/mutation. Defaultfalse
preserves existing consumers. The delayed PATCH and GET scenarios were rerun and
both Back and notification were disabled. Native hardware Back/gesture is untested.

The first B-login attempt was not executed because automatic approval review hit 429. A later attempt through the same normal review succeeded; the B scenario above
is verified, not inferred from that failed attempt.

## Transport limitation observed

The initial unknown-commit simulation destroyed a reused connection before sending
response bytes. Chromium transparently replayed the POST at transport level; two
fixture creates occurred. The app did not explicitly retry. The corrected harness
sends status/partial JSON before truncation, yielding a reproducible ambiguous
response without that browser replay. Node and browser tests then recorded one POST.
Client guards prevent deliberate duplicate submission/retry; they cannot establish
exactly-once creation under transport replay without a backend idempotency contract.
No Idempotency-Key or invented backend replay guarantee was added.

## Visual evidence and limits

- [Conflict comparison](screenshots/conflict-comparison.jpg):390x844, current editor,
  saved/server goal comparison and explicit keep/discard choices, Nunito/theme.
- [Editor at320](screenshots/editor-320.jpg): wrapped options and slot text.
  Editor document scrollWidth equals clientWidth at320/375/430 in web checks.
- Web measurements do not prove native keyboard, safe area, font scale130%,
  Android hardware Back or iOS gestures. T030..T032 remain Pending.

Final automated checkpoint:140/140 tests, lint/typecheck pass, structure328 files.
Tests cover actual feature API/common HTTP and actual TanStack infinite-query
options against loopback HTTP; pure recovery/preflight tests supplement browser
journeys. Eligibility/moderation/ranking/lock values remain simulated server responses.

## Date/time selection UI — 2026-10-12

New loopback session, fake actorA; web390x844. No real API mutation.

- New form has no preferredSlots textarea or expiresAt timestamp textbox.
  Add creates Bắt đầu/Kết thúc selectors; cancel a staged selection keeps empty
  or the previous value. Confirm applies the local date/time.
- Web calendar buttons/selects choose dates/hours/minutes; native uses Expo UI.
  Past calendar days are disabled. Date part keeps time; time part keeps date.
- end=start blocks form submission with an actionable field error, then a later
  end clears it. Five rows disable Add; removing extra rows leaves the first
  selected range intact. Add reads current RHF value to guard rapid clicks.
- Create503 leaves range/custom expiry intact; manual Save201 opens correct detail.
  UI range12/11/2026 19:01->20:01 (UTC+7 device) becomes
  `2026-11-12T12:01:00Z`->`2026-11-12T13:01:00Z` in fixture data.
  Custom13/11/2026 21:00 becomes `2026-11-13T14:00:00Z`; reopened editor shows
  the same local choices. No Session duration rule was added.
- Editor: open expiry picker, choose Dùng hạn mặc định; picker closes and clears
  staged selection. Delete final range and Save PATCH200: version2,
  preferredSlots[] and requestedExpiresAtnull. Other fields remain intact.
- Calendar/control layout scrollWidth equals clientWidth at320/375/430; footer
  reached by keyboard focus, month/day labels are Vietnamese. Native device
  interaction/font130%/keyboard/hardware Back remains unverified.

[Calendar picker390](screenshots/date-time-picker.jpg),
[calendar at320](screenshots/date-time-picker-320.jpg).
144 tests and final lint/typecheck/structure333 pass; final iOS2207/Android2250
module exports pass. Exports validate native bundling, not native interaction.

## Weekly UI correction — 2026-10-12

Fixture4315 + separate Expo web8082, fake accountA only; no writes to real API.
Form now picks weekday/clock, not a calendar date for new availability. At390:
clock disabled until weekday; MON19:00–21:00 -> SAT retained clocks; staging09:00
then Cancel kept19:00. Five rows disabled Add; Save disabled and one short backend
notice while weekly choices exist. Removing all rows reopened Save. Expiry14/10
confirmed, clear restored default. Calendar DOM computed day font12px/height44.
Back returned to Mine; existing fixture date range13/10 09:00–16:00 reopened under
"Khoảng ngày đã lưu", without inference of a weekly recurrence. Contract guard
and weekly recovery validated in automated tests; no weekly API integration claimed.

153/153 tests; lint/typecheck/structure338. Native acceptance and weekly backend
integration remain pending (T030..T032/AC-16, B08/T036).
[Weekly choices](screenshots/weekly-availability.jpg),
[expiry calendar](screenshots/expiry-calendar-small-font.jpg).
