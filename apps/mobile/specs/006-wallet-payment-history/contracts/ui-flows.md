# Wallet, history and Payment UI contracts

## History visual refresh / date filter deferred — 2026-10-18

User requested date filtering and a more modern history screen. Source review found no date filter in `services/api/src/modules/credit/presentation/http/wallet.dto.ts` (LedgerQueryDto), `infrastructure/persistence/prisma-wallet.repository.ts` (list predicate) or `domain/ledger-cursor.ts` (signed scope), all under the credit module. Asked whether to extend backend for complete filtering or explicitly filter only loaded rows; user answered “tạm thời chưa thêm đi”. Date filtering is deferred: no date controls, partial-page date filtering, invented query parameters or backend changes.

Presentation uses a more compact inline filter card, one white transaction list with rounded outer corners, subdued icons and dividers, a separate status badge, aligned amount and wrapping Available/Held delta chips. Delta colors follow the actual signed availableDelta, never type; the main amount remains the supplied magnitude without an inferred sign. Unknown statuses remain neutral and labeled. All labels use existing Nunito/theme tokens. Existing filter mappings, backend order, exact amounts, pagination/session boundaries, detail/Back, error/retry and single-loading behavior are preserved. No balances/totals are derived from the list.

## Single loading indicator — 2026-10-18

Wallet, History and transaction detail retain their existing data while refreshing. On native, the existing pull-to-refresh indicator owns refresh presentation; FinancialReadState suppresses its duplicate refreshing block. Initial loading and retryable errors remain inline. On web, where the installed RefreshControl has no visible implementation, exactly one inline indicator remains. Preview and Payment status retain inline presentation. History load-more has one disabled “Đang tải thêm…” button; no second loading caption or old page-error caption appears during that request. No new request, retry/polling policy or financial behavior is introduced.

## Inline expandable filter card — 2026-10-18

User clarified that the control should be a card that expands to reveal choices directly below its header, then collapses after selection. This supersedes the platform select/Picker presentations below. `history-filter-card.tsx` is the shared React Native presentation: selected value/caption/filter icon/chevron in one trigger; inline option buttons with current-selection tint/check mark. Native and web adapters own only disclosure/focus state. The separate contextual hint and all3 category mappings/retained custom filter remain unchanged. Choosing the already active option closes without a redundant read. Open/close never mutates financial data.

Web exposes trigger expanded/controls semantics, option pressed states, Enter/Space/Tab behavior from the existing Pressable, focus return on selection, Escape to close and closing when focus leaves the card. Native uses the same inline layout per the user's explicit design, accessibility state and escape callback; actual device/touch/screen-reader acceptance is separate. This is an inline disclosure, not a modal, overlay or new screen. No query/schema/cursor/pagination/session, backend, dependency or financial capability change.

## Compact dropdown correction — 2026-10-18

User rejected the framed filter selector. The trigger now has a single white rounded surface, quiet border, aligned neutral filter icon/current label/downward chevron and a small external field caption; outer card/badge/stacked backgrounds are removed. Category hints, list headings and empty/error annotations remain unchanged. Web keeps the real labeled select with keyboard-only focus-visible ring; pointer focus does not add the old heavy outline. Native retains Expo menu Picker, full-width host with vertical content measurement, and concise option text instead of repeating the full field name in every visible item. Host and visible caption name the field; actual device/accessibility acceptance remains separate. Existing3 options, retained custom selection, exact queries, pagination, session isolation and all financial gates are unchanged.

## History presentation polish — 2026-10-18

User requested a better filter card and appropriate annotations. The same three-category dropdown remains, with a compact icon/title, app palette, warm inset field, downward chevron and preserved keyboard focus on web; native retains the existing Expo Picker. A short description changes with the selected group: recorded wallet activity, recorded top-ups, or learning-path holds/payments/earnings/returns/fees. Retained custom selections are still honest and removable through selection; no category/HTTP/filter change.

The nonempty list has “Giao dịch / Mới nhất trước” for orientation. Empty results have one distinct title/description: all-history versus selected-group guidance, referencing the actual “Tất cả giao dịch” option. Duplicate generic empty text and the redundant zero-count footer are removed. Read failures remain separate from successful empty results; retry, cursor restart, retained data on later-page error and load-more are preserved. Pagination error annotations use ordinary wording, not page/cursor jargon. No new time filter, inferred balance/outcome, auto polling, dependency, backend or financial capability change. The light peach balance card and previous natural top-up actions remain unchanged.

## SRS-aligned dropdown and light balance card — 2026-10-18

Current user direction supersedes the six-chip follow-up below: retain the dropdown interaction, use meaningful business categories, and replace the dark green balance card with the app's light peach `amberSoft`, dark text/primary icons and subtle primary border. Amounts, ownership and read states are unchanged.

Directly reviewed `docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx`, section6.7 FR-CR-01/04/06/07/09, BR-27, appendixB, sections18.15/18.40/18.41. The SRS is not restricted to top-up and learning payments: it requires ledger entries for Hold/Release, returns, teaching payments/earnings, fees, bonuses, refunds, penalties, adjustments and material purchases/sales. A posted Learning Request is not itself a Credit charge: Hold follows confirmed plans/schedules; settlement follows completion of the entire Learning Path and dispute checks. Source inspection is not deployed financial acceptance.

Runtime writer evidence at current checkout: `services/api/src/modules/credit/application/services/credit-operations.service.ts:61–105` posts `TOP_UP` under `PAYMENT`; `credit-ledger.service.ts:71–114,251–254,310–376` posts `HOLD`, `TEACHING_PAYMENT`, `TEACHING_EARNING`, `PATH_RETURN`, `PLATFORM_FEE` under `LEARNING_PATH`. Full non-generated source search found no corresponding runtime writers for bonus/material purchase/sale/refund/penalty/adjustment; their enum/SRS presence is not implementation proof. This does not claim RELEASE is implemented either.

The single normal dropdown presents:

| User label        | Existing request filter       | Meaning                                                                                                                                                    |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tất cả giao dịch  | No type/referenceType         | Every returned kind, including future or existing records without a dedicated category.                                                                    |
| Nạp Credit        | `type=TOP_UP`                 | Recorded Credit top-ups, not pending Payment orders.                                                                                                       |
| Giao dịch học tập | `referenceType=LEARNING_PATH` | All recorded learning-related Hold, settlement, returns, teacher earnings and fees. Not just `TEACHING_PAYMENT`, nor a fee for posting a Learning Request. |

These three categories are a presentation choice based on current writers, not an SRS-mandated list. Filtering by referenceType is implemented in `presentation/http/wallet.dto.ts:18–39`, `application/use-cases/list-credit-transactions.use-case.ts:20–45`, `infrastructure/persistence/prisma-wallet.repository.ts:54–69`. No synthetic multi-type/OR query or account-page filtering is introduced. Category changes replace old restrictions and use the existing new cursor chain with limit20. A retained legacy custom selection stays visibly named until explicitly changed; no on-mount reset. Existing API/parser support for exact type/reference AND remains. Web uses the existing labeled select and native the existing Expo Picker; no new dependency or platform migration. Earlier natural action labels remain. No extra proposed purchase/bonus flow is activated.

## Filter and action-copy follow-up — 2026-10-18

This user-requested follow-up supersedes the earlier collapsed-selector UI. History shows six quick choices only: Tất cả, Nạp Credit (`TOP_UP`), Tạm giữ (`HOLD`), Thanh toán học (`TEACHING_PAYMENT`), Thu nhập dạy (`TEACHING_EARNING`), Phí (`PLATFORM_FEE`). Each is a single existing backend type; these are not inferred income/expense groups. Tất cả still shows all backend transaction kinds, including types without a dedicated chip. Technical `referenceType` options are removed from the normal UI, not from the API contract. A previously retained custom/type+reference selection remains explicitly labeled with a clear action until the user chooses a shortcut; a new shortcut clears both old restrictions and starts the existing fresh cursor chain. No on-mount selection/reset, client filtering of account pages, schema or pagination change.

Chips use the same capsule, soft primary background, signed-in orange border and dark primary text as the app's request filters; a check mark plus radio/checked semantics identifies selection beyond color. Amount shortcuts use the same selected border/text colors. Copy changes: draft action “Tiếp tục”, review heading “Thông tin nạp Credit”, disabled real action “Xác nhận nạp Credit”, secondary “Thay đổi số tiền”, history continuation “Xem thêm”, error-only cursor reset “Làm mới lịch sử”. The separate unavailable explanation and synthetic confirmation label remain; no real Payment/Confirm capability is enabled.

## UI refinement — 2026-10-18

User requested a visual refinement before further Payment integration. Wallet-local components now reuse `constants/theme.ts` Nunito families and the shared 13/15/17/20 typography ramp, signed-in colors and radii. This replaces generic preview Fraunces headings without restyling unrelated features or changing shared primitives. Wallet leads with Available/Held, one primary top-up action and a history entry. History uses compact grouped rows; magnitude is unsigned and recorded Available/Held deltas remain explicitly signed. Full post-balances, IDs and reversal/reference fields remain in detail.

Top-up shortcuts (50,000/100,000/200,000/500,000 VND) only populate canonical text through existing validation. There is no default selection, new quote, rounding, API or payment dispatch. Draft has one review action; disabled real Confirm appears only at review. Back preserves the draft. The estimate remains labeled as an estimate.

Always-visible successful-state “Cập nhật số dư/lịch sử/giao dịch” buttons are removed. Existing focus/foreground/reconnect reads remain; native pull-to-refresh calls the same scoped GET handlers. Errors retain explicit retry, pagination retains load-more/continuation retry and invalid-cursor restart. Fresh confirmed Payment outcomes omit redundant Check again; pending/REVIEW/unknown/stale/error retain it when authorized. No polling/SSE interval, create replay or new capability is introduced. PAID still survives Wallet/History refresh errors.

Design references: [Revolut 10 navigation/access simplification](https://www.revolut.com/blog/post/revolut-10/) and [MoMo history-to-detail guidance](https://www.momo.vn/hoi-dap). These inform hierarchy and progressive detail only; this is not a copy or claim about their current complete UI. D1, production Payment/Confirm gates, preview isolation and separate real API/payOS/native acceptance remain unchanged. Task IDs and checkboxes are unchanged by this refinement.

**Updated**: 2026-10-17 at4121c3f versus17e3ac1. Backend create/status/posting are now source-backed; current mobile Payment UI remains inert/unavailable until later integration and gates. [HTTP contract](payment-http.md), [recovery](payment-recovery.md) and [integration gates](integration-gates.md) determine permitted actions.

## Shared entry, scope and accessibility

Home and own Profile open the same Wallet. Existing six routes stay thin, importing the public wallet feature; UI/HTTP/state logic stays inside the feature. Back preserves origin or uses Wallet/History fallback; direct links do not inject financial outcomes.

All financial requests capture owner/session generation and signal. Logout/account switch/denial removes private projections/raw QR/drafts and rejects late results. Blur/background stops status observation; foreground/reconnect can recover active authorized reads through existing connection handling, never create/replay a mutation automatically.

Every screen distinguishes loading, confirmed data/zero/empty, stale refresh, error, denied and unavailable. Use readable Vietnamese labels, announced state and accessible names/disabled state; never color alone. Draft/error copy and Back remain usable at320width, large text and keyboard/screen reader. Preview is labeled, synthetic and disconnected from account cache/financial egress.

## Wallet/Home — existing P2

| Start / user action         | Confirmed result                                          | Error, retry and end                                                     |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Auth ready, focus/open      | Shared scoped Wallet GET loads Available/Held and version | Initial loading is not zero. Missing/malformed fields are protocol error |
| Successful virtual zero     | Render0.00/0.00/version0 normally                         | No init/grant mutation; zero is only from successful authorized response |
| Pull/manual refresh         | Home and Wallet use the same fresh owner projection       | Same-session older data may remain visibly stale; retry GET only         |
| Denial/session change       | Remove private projection                                 | Safe Back/login; old/error response never restores balance               |
| Read capability unavailable | Explain unavailable                                       | No sample0/180CR fallback; other Home content unchanged                  |

No client sum/credit/refund or withdrawal actions. Wallet acceptance remains independent of History/Payment.

## History/detail — existing P3

| Start / user action                  | Confirmed result                                                        | Error, retry and end                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Owner opens History                  | List20 in backend ledger-sequence order                                 | Confirmed empty distinct from unavailable/error                                             |
| Load more                            | Opaque cursor continuation, ID dedupe, original order                   | Later-page error retains earlier pages and retry for that continuation                      |
| Type/referenceType change or refresh | New cursor-free chain; refresh atomically rebuilds loaded continuations | Never mix old continuation/new first page, client timestamp-sort or send status/date/search |
| Invalid cursor                       | Explain restart and request a fresh chain                               | No cursor decoding, synthetic repair or shared parser widening                              |
| Select ID                            | Owner detail read validates exact target and monetary strings           | Nonowner/missing/denied removes cached detail, no list fallback                             |
| Reference/reversal visible           | Supplied recorded magnitude/deltas/post-balances and safe text          | No inferred refund/settlement, sample destination or unauthorized navigation                |
| Back/session replacement             | Correct History/origin; no stale private row                            | Late filter/session responses ignored                                                       |

## Top-up review and create — future integration

1. **Enter**: retain exact integer VND draft; validate1000..2000000, step1000 and PAYOS. Invalid/blank/fractional/off-step values retain input with reason. No unsupported gateway choice.
2. **Review**: show VND, standard1000VND/Credit and estimated Credit before create. No public quote endpoint exists. Back preserves draft; no synthetic quoteId/expiry is presented as server-confirmed.
3. **Confirm**: current normal Confirm stays unavailable. In a later gated integration, explicit action synchronously claims stable owner/key/body before dispatch through shared client with replayAfterRenewal:false and no mutation retry.
4. **Response**:201/200 binds actual owner Payment ID, quote/version and backend status, even if already PAID/REVIEW or checkout:null. Do not require PENDING/QR to consider creation confirmed. Quote mismatch freezes existing association for safe review/read rather than silently creating again.
5. **Uncertain dispatch**: timeout/abort/lost/invalid response becomes UNKNOWN_OUTCOME. Explain that result is unresolved; keep same intent and block new top-up. Recovery is known-ID GET or approved deliberate same-key/body replay; no auto resend on reconnect/renewal/remount.
6. **Rejected dispatch**: display actual policy/config/provenance error. Only proven no-creation with no prior unknown permits correction/new explicit review.409/503 alone cannot clear uncertainty.
7. **End**: explicit Back or known-ID continuation. Closing/leaving QR does not cancel, fail, expire or pay the payment. No withdrawal/admin/refund execution.

## QR presentation — QR-01 still blocked

Start only with an authorized known Payment projection. CREATED or PENDING with checkout:null shows preparation/QR unavailable, Check again and Back. It never starts a new create. REVIEW shows neutral “Cần kiểm tra/đối soát”, with no fabricated reason.

Non-null raw QR is encoded locally only after reviewed encoder/decoder gate. Preserve bytes/text; no remote QR image/service, WebView/browser, arbitrary URI/XML, provider SDK/secrets, bank-app deep link or save/share action is implied. Renderer failure retains payment access and offers render retry; a status/read retry is separate.

A server same-version checkout:null must hide the old QR. Do not restore it from late equal/lower-version data, or convert disappearance into EXPIRED. No client TTL reset or authoritative countdown. Quiet zone/contrast/module size and independent decode need actual renderer tests, including target native devices.

## Owner Payment status — future independent US3 integration

Start from authenticated session + validated Payment UUID. GET bootstraps confirmed quote/status; no US2 intent/route amount is required. URL state/amount/providerStatus are ignored as authority.

| Backend/read state                  | Presentation / action                                             | Exit / retry rule                                                                   |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Loading/unavailable                 | Honest loading or disabled capability explanation                 | Back; no sample projection                                                          |
| CREATED/PENDING                     | Verification/preparation incomplete                               | Manual Check again, coalesced one active read; no invented polling/expiry           |
| PAID                                | Backend-confirmed success and exact confirmed VND/Credit          | Trigger independent scoped Wallet/History reads                                     |
| PAID + dependent refresh error      | Payment success retained, affected data visibly stale/unavailable | Retry reads only; no create/credit/ledger synthesis                                 |
| FAILED/EXPIRED/REFUNDED             | Explain exact observed outcome                                    | Back to Wallet/History; any new top-up explicit and only after uncertainty resolved |
| REVIEW                              | Neutral needs checking/reconciliation                             | Check again and Back; no FAILED/reason/admin interpretation                         |
| Unknown future status               | Unconfirmed/unsupported result                                    | Safe read retry/Back, never success                                                 |
| Transient read error                | Keep valid same-session projection visibly stale if available     | Retry GET only                                                                      |
| Denied/wrong ID                     | Remove private projection/QR                                      | Safe Back, no old cache resurrection                                                |
| Lower version / old ticket          | Ignore old response                                               | Current projection retained                                                         |
| Higher version                      | Accept after identity/immutable quote checks                      | Allow newer EXPIRED→PAID without state rank                                         |
| Equal-version status/quote conflict | Preserve last confirmed result stale/protocol issue               | Manual GET, no enum/time guessing                                                   |

Cleanup on blur/background/logout/account switch cancels observer and invalidates tickets. Departure/read exhaustion does not imply failed or expired. No SSE or polling schedule is selected.

## Optional minimal owner discovery

Backend GET/payments accepts20/cursor/status only and may support a future minimal “find my payment” recovery entry. Keep it separate from transaction History: status membership is mutable even under a stable order watermark. User explicitly selects a returned owner ID, then detail GET. Amount/time proximity never correlates a lost intent or proves no creation. Do not implement a unified payment/ledger feed under this replan.

## Preparation vs activation

Existing synthetic P4/P5 interactions remain labeled and isolated; current real Confirm/status and Payment flags remain off. A future capability may be enabled only for its completed contract/behavior/evidence scope. Known-ID reads need no QR renderer or create intent; real QR continuation needs QR-01 and recovery/operational gates. [Validation matrix](../validation-matrix.md) preserves separate L/C/W/A/G/NA/NI outcomes.
