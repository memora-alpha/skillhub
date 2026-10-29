# Trạng thái Phase04 Learning Request và Discovery

## Đồng bộ owner avatar theo BE 232cb6ba

Follow-up trên `fix/mobile-proposal-chat-learning-path`; fetch ngày 2026-10-27 xác nhận `origin/dev` 79d4bb1f đã có trong nhánh hiện tại, không có commit BE mới khác. Chỉ sửa `apps/mobile`; source/tests đã commit tại `0c533023` (`fix(mobile): use learning request owner avatars`) theo yêu cầu ngày2026-10-27, tài liệu bàn giao trong commit riêng. Lint-staged/commitlint đạt, chưa push.

- Schema public feed/recommended/detail nhận bắt buộc nullable `owner.avatarUrl`, validate HTTP(S) và giữ loại bỏ metadata riêng tư. Fixture public đã theo contract mới; projection owner/moderation giữ nguyên.
- Card và chi tiết dùng URL response trực tiếp; null dùng initials, offscreen không kích hoạt tải ảnh hoặc profile. Không lookup profile chỉ để hiển thị avatar còn hạn.
- Hạn URL S3 được tính từ server signing time/lifetime. URL hết hạn hoặc Image lỗi chuyển sang profile query hiện có, không dùng lại URL profile cache hết hạn; lỗi URL cũ không chặn URL response mới. Giữ cache/session/denial/dedup/freshness30s, không thêm polling/timer/replay hoặc tăng TTL. Avatar dùng chung thêm callback lỗi tùy chọn, fallback initials không đổi.

Kiểm chứng: **868/868 full tests PASS**, TypeScript, ESLint toàn mobile, structure **792 source files** và export Android/iOS/web PASS. **19/19 focused** cho LR/API/Discovery/Proposal và **8/8 focused cuối** cho owner avatar/UI/Proposal navigation; 5 regression mới, cập nhật mock UI cũ theo hook mới. Logs ignored `.expo/be-owner-avatar-full-final.log`, `.expo/be-owner-avatar-types-final.log`, `.expo/be-owner-avatar-lint-final.log`, `.expo/be-owner-avatar-focused.log`, `.expo/be-owner-avatar-focused-final.log`, `.expo/be-owner-avatar-export.log`; bundle `.expo/be-owner-avatar-export`. Export dùng default Expo config cùng override tạm loại artifact `.expo` khỏi scan, không sửa config app.

Không sửa BE/shared/dependencies, không chạy migration/seed hoặc gọi API thật bằng tài khoản người dùng. Chưa nghiệm thu deployment BE hoặc tải ảnh trên điện thoại thật; acceptance gốc bên dưới vẫn mở.

## Hiện trạng

- Cập nhật lúc: 2026-10-27T09:48:54+07:00.
- Trạng thái: In progress — đồng bộ owner avatar theo BE232cb6ba đã hoàn tất source và automated checks; real API/native acceptance và motion trên thiết bị vẫn mở. PT-09/PT-10 giữ checkpoint bên dưới.
- Nhánh proposedTags trước đó: `fix/mobile-learning-request-proposed-tags`, khởi tạo từ dev0318bf7e, hiện đặt trên dev6a847121 sau hoàn tác push nhầm. Source được đưa lại thành3 commit d0661167/450cffc7/7d79d058, tài liệu đi riêng; upstream đúng `origin/fix/mobile-learning-request-proposed-tags`.
- Đã có trong source: phần CRUD/list/detail/discovery, Tag/weekly/FR-35 và profile kế thừa baseline; mới tích hợp proposedTags theo BE commit9d356167. Bảng baseline phía dưới giữ evidence theo thời điểm, không suy toàn bộ nghiệp vụ từ thay đổi này.
- Nghiệm thu người dùng: Chưa thực hiện trong migration; không giả nhận từ checkbox lịch sử.
- Chưa hoàn tất: T025..T029 real API theo từng gate và T030..T032 Android/iOS/native fixes khi có lỗi thật; FR-35/weekly/catalog mobile User acceptance cùng các task đó.
- Bước tiếp theo: Review qua PR nhánh feature vào dev; kiểm đóng/mở bộ lọc, keyboard/Back trên thiết bị sau reload; PT-04 kiểm proposedTags với API đã apply migration20261024000000. Các gate B06/T025..T032 cũ vẫn theo [plan](plan.md); không tự chạy migration hoặc thao tác Staff từ mobile.

## Bằng chứng hiện hành

| Phạm vi                                       | Kết quả                                                       | Mốc nguồn                 | Evidence/giới hạn                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review source/contract hiện tại               | Có API và Tag/weekly/preferences; không blanket503 cũ         | 2026-10-19T19:58:07+07:00 | [requests-api](../../../src/features/learning-requests/api/requests-api.ts), [backend module](../../../../../services/api/src/modules/learning-requests/learning-requests.module.ts), [contract](../../contracts/learning-requests.md), HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd |
| Automated/fixture/web                         | Kết quả được ghi nhận ở lần chạy trước, không chạy lại        | 2026-10-13/14             | [validation005](../../../specs/005-learning-request/validation.md): development-readiness266 tests; follow-up cuối267; số đếm thuộc các revision riêng, không cộng                                                                                                                    |
| Profile context/mock Proposal                 | Fixture navigation/denial/back/local-only có evidence lịch sử | 2026-10-13                | Cùng validation005 và [validation003](../../../specs/003-profile-public-profile/validation.md); zero Proposal HTTP trong fixture không chứng minh API thật                                                                                                                            |
| Real API/LR migration/runtime moderation/lock | NOT_RUN trong migration; acceptance trước còn mở              | Tasks/resume005           | API source không chứng minh deployment; không tạo/sửa/hủy bài thật                                                                                                                                                                                                                    |
| Android/iOS                                   | NOT_RUN cho phần acceptance đang mở                           | Tasks005 T030..T032       | JS/Hermes export/ảnh web không native UAT                                                                                                                                                                                                                                             |
| Sonar remote closure                          | Chưa xác minh                                                 | Validation005 2026-10-14  | Local fixes/tests không thay CI analysis/Quality Gate mới                                                                                                                                                                                                                             |

## Blocker và đính chính lịch sử

B05 Tag và B08 weekly không còn là thiếu source contract ở baseline hiện tại. T021..T024/T036 đã checked trong tasks và có source; các đoạn “weekly Save disabled”, “Tag deferred” hoặc blanket503 là lịch sử. Không sửa specs gốc. B01/B02/B03 source wired nhưng runtime/data chưa nghiệm thu; B06 migration/grants/config vẫn cần kiểm môi trường. B04 NEGOTIATING lock chưa wired. B07 Proposal/Notification ngoài scope; public profile source đã nối theo amendment003.

resume nhắc T037/FR-35 nhưng tasks không có task definition T037. Giữ tham chiếu và đưa acceptance vào T026/T030/T031 theo plan, không tạo lịch sử hoàn thành giả. Một số checkbox tổng hợp cũ còn mở dù task con/source mới đã có: không đếm lại và không tick thay chủ sở hữu.

## Review và nhật ký

### 2026-10-24T23:37:14+07:00 — khôi phục sau push nhầm dev

Người dùng chọn hoàn tác4 commit trên dev và giữ code ở nhánh riêng. Reflog và remote xác nhận dev đã nhận30f94200; feature local còn trỏ upstream origin/dev, nhánh remote cùng tên chưa có. Đã xuất bản nhánh feature trước để giữ code và đặt lại upstream đúng tên.

Commit revert6a847121 đã push lên dev bằng cập nhật fast-forward, không force-push hoặc viết lại lịch sử. So sánh toàn tree xác nhận nội dung dev sau revert khớp0318bf7e, không gỡ thay đổi khác. Local dev cũng được fast-forward về trạng thái đó.

Feature được fast-forward qua revert rồi đưa lại từng nhóm để PR vào dev vẫn có4 commit cần review: da532aad→d0661167 (tag),79de4483→450cffc7 (form),1035465b→7d79d058 (feed), cùng commit tài liệu riêng. Mỗi nhóm dùng cherry-pick không commit rồi commit bình thường để lint-staged/commitlint vẫn chạy; so sánh index trước mỗi commit với tree tương ứng đều khớp. Trước cập nhật ghi nhận này, toàn tree khớp bản30f94200 đã kiểm; source/tests không thay đổi nên evidence834/834 và bundle ở PT-09/PT-10 tiếp tục áp dụng. Native/API/Staff acceptance vẫn chưa xác nhận. Không tự tạo/merge PR.

### 2026-10-24T22:56:35+07:00 — chia commit theo yêu cầu

Đã tách source thành3 commit trên nhánh hiện tại, không đổi nội dung implementation:

- da532aad — feat(mobile): support proposed learning request tags. Schema/default/input/PATCH/recovery, unified tag input và owner/public display; form/card được stage riêng phần tag để không kéo theo bố cục và feed.
- 79de4483 — refactor(mobile): streamline learning request forms and pickers. Form thu gọn, shared picker sheet/controls, stable weekly rows, lazy offerings và regression tương ứng. Sheet có sẵn API X/height và selectors có active prop để consumer bộ lọc ở commit tiếp theo sử dụng.
- 1035465b — perf(mobile): optimize request feeds and filters. Auto-pagination/cache/focus/loading/denial eviction, compact cards, filter sheet/removable named chips và proposal refresh.

Commit tài liệu riêng ghi contract, task và evidence. TypeScript chạy trên đúng nội dung index của hai commit đầu đều đạt (`.expo/commit1-types.log`, `commit2-types.log`); source/test cuối giữ nguyên so với trước khi chia. Checks full834/834, lint/types/structure/export ở PT-09/PT-10 tiếp tục là evidence của cùng source. Đã review staged diff và chạy pre-commit lint-staged/commitlint bình thường cho3 source commits, không bypass hooks; working content sau hooks khớp bản trước khi chia. Chưa push; native/real API acceptance không được suy ra từ commit.

### 2026-10-24T22:10:25+07:00 — sửa list và đóng bộ lọc PT-09/PT-10

Theo yêu cầu người dùng thực hiện3 điểm review và đổi nút Đóng thành X, xử lý bảng lọc thu lại/phóng ra. Chỉ sửa mobile, giữ route/theme/session/API contract; không BE/shared/dependency/commit.

- useRequestList ẩn data/items/next-page actions ngay khi GET403/404. Effect evict riêng data/dataUpdatedAt sau khi read đã idle, giữ error/status để banner quyền vẫn hiện; không dùng setQueryData vốn reset lỗi sang success. Hết quyền ở trang tiếp theo cũng dùng full-read retry thay vì nút thử lại cursor đã mất. TanStack regression kiểm cả refetch và next-page403, cache bị xóa,503 sau đó không hồi sinh card, read thành công mới render lại.
- Mine/feed có query.data rỗng gặp429/network/5xx hiện loading thay Empty. Cached content có item vẫn được giữ với loading nhẹ; lỗi quyền vẫn rõ. Offering picker empty/closed không fetch /me/skills; mở picker hoặc có selected IDs vẫn resolve labels/paging như cũ, transport nhận AbortSignal. Không thay default consumers khác.
- Bộ lọc giữ RequestPickerSheet mounted để native/web chạy hết chu kỳ dismiss; nội dung không bị rút khỏi sheet trước animation. Đặt snap point rõ ràng và giữ cùng chiều cao từ lúc mở đến khi đóng, bỏ auto-fit co theo nội dung/bàn phím, dành32px cho handle. X vùng44x44 và accessible label Đóng bộ lọc yêu cầu học; dismiss keyboard khi đóng. Skill/tag catalog có active guard khi filter đóng; các controls không đổi sang disabled màu xám trong lúc thoát, Apply kiểm open để không commit draft sau hủy.

Đã đạt regression6/6 về list denial/cached-empty/filter mounted state và sheet height, offering regression1/1; full cuối834/834 đạt sau tinh chỉnh active/handle spacing. TypeScript/ESLint và structure777 đạt; export Android/iOS/web max-workers1 đạt sau dừng lượt export max-workers2 kéo dài, không sửa config hoặc dừng Metro của người dùng. Log `.expo/list-fixes-{regression,offerings,focused,full,types,lint,structure,export}.log` ignored.

Web tương tác actual components + fixture/adapter như PT-08: mở/chọn tag/tìm/hủy bằng X → không áp dụng; mở lại/chọn/Áp dụng → chip tên; mở lại giữ tag đã áp dụng. Đo DOM panel height576px cả trạng thái open và closed trong animation, root transform none; ảnh `.expo/list-fixes-filter.png`, số đo `.expo/list-fixes-motion.json`. Host mô phỏng window800→420 khi keyboard mở rồi đóng vẫn giữ snap640. Không xác nhận motion native từ web; keyboard/Back/OS presentation trên Android/iOS, real API và Staff NOT_RUN. Chưa stage/commit/push.

### 2026-10-24T21:51:24+07:00 — rà Learning Request sau PT-08

Theo yêu cầu kiểm tra, chưa sửa source sản phẩm. TypeScript/ESLint max-warnings0, structure777 và full830/830 chạy lại đạt. Suite hiện có chưa phủ các ca được kiểm bổ sung bằng ignored host harness/actual TanStack observer và API adapter:

- Mine có card trong cache, refetch GET403: banner lỗi xuất hiện nhưng FlatList vẫn nhận toàn bộ query.items và render card. Request list chưa có denial eviction/visibility guard như detail. Không thấy account/session crossover; vấn đề là tiếp tục trình bày snapshot sau khi cùng phiên bị từ chối quyền đọc. Feed dùng cùng cơ chế truyền data trực tiếp.
- Mine đã tải thành công data.pages với items[], refetch GET429: query.data vẫn tồn tại nên ListEmptyComponent là Empty và không có LoadingIndicator trong header (guard items.length). Hiện thông báo chưa có yêu cầu thay vì trạng thái đang chờ dữ liệu; feed có cùng nhánh. Không áp dụng cho initial query chưa từng có data, vốn đang loading đúng.
- Form mới, selected offerings[] và expanded=false: useOfferingPicker vẫn gọi useOfferingOptions luôn enabled theo session; actual API adapter ghi nhận GET /me/skills?limit=20 ngay khi mount dù RequestSection thu gọn. Đây là read phụ chưa lazy, khác với skill/tag picker có gate mở; chưa thay đổi logic label/paging.

`.expo/list-audit-repro.log` ghi4 kiểm chứng đạt, trong đó3 observation trên xác nhận hành vi hiện tại, không phải regression chứng minh đã sửa. `.expo/list-audit-{types,lint,structure,full}.log` là evidence checks. Không chạy lại export vì không sửa code; không gọi server thật, không native/API/Staff UAT. PT-09 còn mở, PT-04 và acceptance gốc giữ nguyên; không stage/commit/push.

### 2026-10-24T21:36:54+07:00 — tối ưu danh sách PT-08

Đã thực hiện6 đề xuất theo yêu cầu, chỉ trong mobile; giữ theme/routes/API/session, không sửa BE/avatar contract hoặc dependencies:

- Mine dùng focus guard và quiet read recovery như feed. GET429/network/5xx chưa có dữ liệu hiện loading, có dữ liệu giữ card và loading nhẹ, trang kế tiếp giữ dữ liệu cũ/loading footer; lỗi không transient vẫn có hướng xử lý. Focus cả mine/feed/recommended chỉ refetch khi stale; mutation invalidation và kéo làm mới giữ refresh chủ động.
- Tên kỹ năng tận dụng catalog cùng owner/session chưa invalidated, giữ thời điểm dữ liệu gốc và staleTime5 phút. Feed pull-to-refresh chỉ refresh lịch sử đề xuất khi query stale (30 giây), vẫn đọc đủ lịch sử khi cần; refresh/retry và flight coalescing không bỏ trạng thái proposal cũ ở các trang sau.
- Card giữ tiêu đề/kỹ năng/Credit và trạng thái, tối đa3 chip với+N; gỡ nút Xem chi tiết riêng, toàn thẻ vẫn mở detail. Bộ lọc chuyển vào RequestPickerSheet, giữ draft đến Áp dụng; đóng bỏ thay đổi chưa áp dụng. Chip ngoài hiện từng tên tag, xóa từng mục; tên đã đọc được truyền lại khi mở sheet, không yêu cầu Tag-by-ID hoặc bỏ ID chưa resolve. Nhãn tạo đổi thành Tạo yêu cầu.
- Feed/mine auto-load tại onEndReachedThreshold0.4, kiểm focus/session, số item, hasNextPage và trạng thái fetch/error mới nhất trong cache; fetchNextPage đồng bộ các trigger trùng. Có lỗi không tự lặp do scroll; quiet recovery dùng timer/backoff hiện có, retry thủ công và invalid-cursor recovery vẫn giữ. Cursor bị lặp kết thúc phân trang để không tải vô hạn; nút Xem thêm vẫn là phương án bổ sung.

Full830/830 đạt (7 regression mới về cache skill/account isolation/invalidation, coalescing/429/retry/repeated cursor, mine quiet/focus, named tag chips/draft dismissal và stale-only sent proposals). Sau bổ sung giữ tên tag khi mở lại, focused catalog/list UI4/4 đạt. TypeScript/ESLint max-warnings0, structure777, Prettier/diff và export Android/iOS/web max-workers2 đạt. Evidence ignored `.expo/list-{focused,full,ui,types,lint,structure,export}.log` và `.expo/list-preview{,-small}.png`.

Web preview dùng actual card/filter/tag/skill/sheet/button với catalog/profile fixtures, icon/keyboard-scroll adapters; đã tương tác chọn2 tag → áp dụng → bỏ1 tag, mở lại/chọn kỹ năng rồi đóng không áp dụng, và xem bố cục320/390px. Paging kiểm bằng TanStack thật/HTTP fixture và host tests, preview không mô phỏng hiệu năng native FlatList. Chưa kiểm API thật, native keyboard/Back/large text hoặc Staff; PT-04 và acceptance gốc vẫn mở. Chưa stage/commit/push.

### 2026-10-24T20:40:16+07:00 — sửa3 lỗi review PT-07

Đã sửa theo yêu cầu người dùng, chỉ trong mobile:

- Editor lịch cấp key riêng cho từng row, giữ key khi sửa và xóa đúng row; callback của row đã xóa hoặc form đã được reset không áp vào row khác. Key không được serialize, weeklyAvailability/giới hạn5/validation/timezone không đổi. Web đã lặp lại ca MON19–21/TUE20–22: mở giờ MON rồi xóa MON, picker cũ biến mất; mở TUE vẫn20–22. Ảnh `.expo/form-fixes-weekly.png`.
- Chuẩn hóa query/exact-match/proposed label qua cùng hàm NFC/trim/collapse whitespace. Query lấy prefix tối đa120 UTF-16 units, không cắt đôi surrogate pair; vẫn validate toàn bộ tên đề xuất gốc. Exact match từ cache được đưa vào các lựa chọn nếu trang hiện tại thiếu; tìm nhiều khoảng trắng không mất nút chọn.
- Dùng một policy canChoose cho nút chạm và handler chọn; keyboard add xử lý canonical trước giới hạn dành cho proposal mới. 9 canonical +1 proposal tương đương có thể thay thành10 canonical, không cho tăng thành11. Web fixture đã tìm `React   Native` ở10/10 và chọn được canonical; proposal/Mới biến mất, counter vẫn10/10, các tag không thay thế được vẫn disabled. Ảnh `.expo/form-fixes-tags.png`.

Regression10/10 (4 test mới) và full823/823 đạt; TypeScript/ESLint max-warnings0, structure776, Prettier/diff và export Android/iOS/web max-workers2 đạt. Logs `.expo/form-fixes-{regression,full,types,lint,export}.log` ignored. Test mới kiểm key của actual RequestTimeFields qua host harness, stale callbacks/rebase, normalized/bounded Unicode queries và nút chạm/keyboard ở full budget. Preview vẫn dùng catalog fixture/adapter như PT-06, không gọi API thật; native keyboard/Back/large text và Staff acceptance NOT_RUN. Chưa stage/commit/push; PT-04 và acceptance gốc giữ mở.

### 2026-10-24T20:27:42+07:00 — rà lỗi form sau PT-06

Theo yêu cầu chỉ kiểm tra, không sửa/stage/commit source sản phẩm. TypeScript/ESLint/structure774 và full819/819 chạy lại đạt, nhưng bộ test hiện có chưa phủ3 ca sau (PT-07 còn mở):

- `request-time-fields.tsx` key theo index tái sử dụng row và DateTimeField state sau khi xóa. Web fixture tái hiện bằng hai lịch MON19–21/TUE20–22: mở picker giờ bắt đầu của MON, xóa MON khi picker còn mở; picker giữ19 trong row TUE, xác nhận khiến TUE đổi20→19. Cần identity ổn định hoặc reset đúng state khi row thay thế. Ảnh `.expo/form-audit-weekly.png`; không gọi API lưu lịch thật.
- Query dùng NFC/trim, exact-match lại collapse whitespace. Host harness với catalog React Native đã tải và tìm `React   Native` cho exact-cache match nhưng options[], UI ẩn cả nút thêm và không có kết quả để chạm chọn; bàn phím submit vẫn là workaround. Khoảng trắng dài còn có thể sinh q141 ký tự dù proposed label chuẩn hóa chỉ12; BE TagQueryDto chặn q>120. Cần thống nhất normalization và kiểm giới hạn trước query.
- Khi9 canonical +1 proposal React Native, tổng10 khiến toàn bộ nút chọn và keyboard add bị chặn bởi full; logic choose trực tiếp có thể thay proposal tương đương thành canonical mà vẫn tổng10. Cần đánh giá số lượng sau thay thế thay vì khóa mọi lựa chọn khi đủ.

Evidence ignored `.expo/form-audit-types.log`, `form-audit-lint.log`, `form-audit-full.log`, `form-audit-repro.log` (3 kiểm chứng host xác nhận hành vi lỗi; không phải regression đã sửa). Web dùng actual form/date controls với catalog fixture và adapter scroll/icon như PT-06; native/API/Staff NOT_RUN. Không đóng PT-04 hoặc tự xác nhận UI acceptance.

### 2026-10-24T16:03:29+07:00 — đồng bộ form gọn hơn PT-06

Người dùng yêu cầu thực hiện toàn bộ đề xuất cho tag/kỹ năng và các ô còn lại. Giữ theme, routes, RHF/Zod, API/session/recovery; không sửa BE/shared packages/dependencies. SkillSelector (gồm consumer filter) và kỹ năng có thể dạy dùng bảng chọn `@expo/ui` BottomSheet + RNHostView, giữ search/debounce/paging/disabled. Shared mobile Button nhận thêm accessibilityState tùy chọn; trạng thái disabled của chính Button luôn được giữ, các consumer cũ không đổi API.

Nhu cầu bắt buộc luôn hiện; các mục Bạn có thể dạy/Tùy chọn học tập/Thời gian/Hạn đăng thu gọn kèm tóm tắt, giữ children mounted để không mất draft và tự hiện khi có lỗi. Mở rộng RequestSection đang có để giữ header theme, summary và disabled/accessibility; universal Collapsible không hỗ trợ các header/state này. Ô nhiều dòng bắt đầu80px và tăng theo nội dung, hint chỉ hiện khi focus/lỗi. Lịch tuần hoàn chỉnh hiện dạng Thứ/giờ để sửa; khoảng thiếu hoặc lỗi vẫn mở. Ngày/giờ, timezone, giới hạn5 và logic thay thế lịch cũ được giữ.

Tag dùng chung một ô tìm/thêm; canonical đã biết được chọn bằng ID, tên đề xuất tương đương được thay bằng canonical khi chọn. Chip đề xuất có màu nhẹ/dấu Mới. Search có debounce, add đợi kết quả ổn định, lỗi danh mục không tự tạo đề xuất. `tagSearch` nằm trong draft/rebase và validation, không serialize ra API: chưa xác nhận sẽ chặn Save, hiện lỗi tại ô và giữ chữ thay vì bỏ nội dung. Giới hạn10, normalization và owner/public boundaries giữ nguyên.

Focused91/91 và full819/819 đạt; TypeScript, ESLint, structure774, Prettier/diff và export Android/iOS/web max-workers2 đạt. Log `.expo/compact-form-*` ignored. Web preview tương tác dùng actual form/RHF/resolver/controls + @expo/ui web; catalog/reads/icon/keyboard-scroll environment là fixture/adapter, Save chỉ serialize local, không gọi API. Đã kiểm chọn kỹ năng, chọn kỹ năng có thể dạy, Save khi tag chưa xác nhận → giữ chữ/lỗi → thêm tag mới/chọn canonical, thu gọn giữ lựa chọn, thêm Thứ2 19:00–21:00/thu gọn và lưu payload đúng, pending disabled. Đã sửa pointerEvents của Host sau khi tái hiện vùng chạm sheet bị chặn trên web. Ảnh `.expo/compact-form-preview.png`; chưa nghiệm thu native keyboard/Back/large text, API thật hoặc Staff. Chưa commit/push.

### 2026-10-24T15:29:33+07:00 — thu gọn giao diện tag PT-05

Theo yêu cầu người dùng giảm chú thích và chỉnh phần thêm tag gọn/hợp lý, tham khảo [Atlassian removable tags](https://atlassian.design/components/tag/examples) và [Select](https://atlassian.design/components/select/examples). Giữ theme SkillHub và shared Input/Button/chip hiện có, không thêm dependency/native control mới.

Form chỉ còn nhãn Tag và một counter tổng; catalog picker có chế độ compact, giữ selected chips và link Chọn từ danh mục/Thu gọn. Input tag mới + nút icon plus48px cùng hàng; label đọc vẫn có cho screen reader, submit bàn phím thêm tag và giữ bàn phím. Gỡ helper dài, counters con và nút bỏ tất cả trong form; chip vẫn xóa từng tag. Chỉ hiện câu “Tag mới sẽ được duyệt cùng bài.” khi có đề xuất. Default selector của bộ lọc/offerings giữ counter/clear và giới hạn cũ; API, normalization, pending/error và tổng10 không đổi. Bỏ raw maxLength160 của ô mới, vẫn validate1–80 code points sau NFC theo BE.

Focused15/15 và full815/815 đạt; TypeScript, ESLint toàn mobile (kiểm lại helper toggle sau tách presentation), structure771, Prettier/diff và export web đạt. Preview dùng actual RN Web components/fonts, catalog mẫu và icon SVG thay thế tương đương, đã nhìn3 trạng thái trống/đã chọn/mở danh mục trong khung320px; nhãn dài xuống dòng. Screenshot/HTML/script/log trong `.expo/compact-tags-*` ignored. Preview là SSR tĩnh, tương tác thêm/trùng tên/xóa/pending được kiểm qua host UI harness; chưa chạy app tương tác/native/API thật. Chưa commit/push.

### 2026-10-24T14:58:17+07:00 — tích hợp proposedTags

Yêu cầu người dùng: tạo nhánh từ dev để đồng bộ mobile với Learning Request BE mới. Đã fetch origin/dev, tạo nhánh fix/mobile-learning-request-proposed-tags tại0318bf7e. Contract đọc trực tiếp từ DTO/domain/use cases và amendment007 của BE commit9d356167; không sửa BE/shared/dependency hoặc API endpoints.

- Owner schema nhận proposedTags, default[] cho response cũ thiếu field, từ chối null/invalid; public schemas bỏ trường này. Form mặc định/reopen/draftToInput/PATCH và conflict comparison/rebase giữ labels; omit PATCH giữ,[] clear, không đưa lại labels đã duyệt khi người dùng giữ draft không sửa field đó.
- Chuẩn hóa giống BE: NFC, trim/collapse whitespace,1–80 code points, không control character và duplicate key không phân biệt hoa/thường; giữ dấu. Validate tổng tagIds+proposedTags<=10. Selector có giới hạn theo số chỗ còn lại; vẫn bỏ được tag khi đã đầy.
- Form có input + Thêm tag đề xuất, chip bỏ từng tag/bỏ tất cả, pending disabled và giải thích duyệt cùng bài. Owner detail có section riêng, Mine card có số tag chưa duyệt; public không render proposed labels. Dùng field/theme/components hiện có, không gọi endpoint tạo tag hoặc thêm yêu cầu catalog riêng. Khi server approve trả proposedTags[] và canonical tagIds mới, section đề xuất tự ẩn qua read hiện hữu.

Focused10/10 và full815/815 đạt (10 regression mới về Unicode/control/duplicates/shared limit, owner-public/API round-trip/PATCH clearing, conflict-rebase, UI add/remove/pending và privacy rendering). TypeScript, ESLint max-warnings0, structure771, Prettier/diff đạt; export Android/iOS/web max-workers2 đạt. Evidence ignored `.expo/proposed-tags-focused-final.log`, `.expo/proposed-tags-full-final.log`, `.expo/proposed-tags-types-verified.log`, `.expo/proposed-tags-lint-verified.log`, `.expo/proposed-tags-export.log`. Host fixture/VM tests và bundles không phải native/API/Staff UAT. Chưa thao tác server/DB, deploy, commit hoặc push; PT-04 vẫn NOT_RUN.

### 2026-10-19T19:58:07+07:00

Review loại Technical cho tài liệu/source baseline bởi agent thực hiện migration: cập nhật contract/readiness từ working tree, giữ task gốc và giới hạn evidence. UI review/native/Product acceptance NOT_RUN; không có lời phê duyệt người dùng. Chưa chạy app checks trong migration. Hồ sơ kiểm tra docs/tooling tại [migration](../../migration.md); tiến hành phần độc lập khi có yêu cầu triển khai về sau.
