# Checklist — Spec 005 Learning Request

Ngày soạn: 2026-10-11. Tham chiếu [spec](spec.md) và [contracts](contracts.md).
Chỉ tick khi có bằng chứng; bản spec không chứng minh đã triển khai.

## Review tài liệu

- [x] Baseline SRS 1.6, FR-LR-01..08, LR-001..009 và BR-07..12 đã đối chiếu.
- [x] Hiện trạng mock/local state và runtime adapters đã xác minh từ source.
- [x] Phạm vi mobile, ranh giới Proposal/Chat/Wallet và guest preview đã ghi rõ.
- [x] Notification tách sang spec riêng; DEP-01 giữ yêu cầu SRS và giới hạn nghiệm thu FR-LR-04.
- [x] Payload, projection, version, expiry, session và error behavior đã ghi rõ.
- [x] Acceptance cases và contract gaps có mã để theo dõi.
- [ ] Chốt contract Tag picker/filter với owner API (GAP-02).
- [ ] Xác nhận readiness Catalog/owner/lock/Sharing Skill trên môi trường tích hợp.
- [x] Ghi [tasks](tasks.md) cho phần triển khai được và dependency còn chờ.

## Nghiệm thu sau triển khai

- [ ] AC-01: Auth, own identity, UUID/deep link và private resource scope.
- [ ] AC-02..04: Biên text/Unicode, Skill/Tag thật và preferredSlots/timezone.
- [ ] AC-05: Create/save/reopen, back/cancel editor, pending và unknown outcome.
- [ ] AC-06: Publish clean/flagged và kết quả moderation qua API thật.
- [ ] AC-07..08: Edit/re-publish, skill immutable, clear/no-change và conflict.
- [ ] AC-09..10: Cancel trước/sau lock, expiry và effectiveStatus khi worker chậm.
- [ ] AC-11..12: Server search/filter/pagination và recommended/503.
- [ ] AC-13: Refresh moderation lỗi và lý do cũ sau sửa/re-publish không bị trình bày như quyết định mới.
- [ ] AC-14: Đổi account khi query/mutation đang chạy không tác động phiên mới.
- [ ] AC-15: Không đưa request thật vào Proposal/profile mock hoặc field demo.
- [ ] AC-16: Android/iOS, keyboard, hardware Back pending, safe area/font lớn.
- [x] Mobile typecheck/lint/structure/tests pass khi có thay đổi source.
- [x] [Validation](validation.md) ghi riêng fixture tests, API thật và native UI.

Các AC đầy đủ còn mở vì chưa kiểm tra với runtime LR thật và Android/iOS.
Không dùng kết quả fixture để xác nhận backend đã sẵn sàng.

## Checkpoint implement 2026-10-12

Mobile-ready T001..T020/T033..T035 có source và evidence;140 tests, lint,
typecheck và structure328 files pass. Coverage từng AC được tách source/fixture/
web/API/native trong [validation](validation.md), có [UI evidence](validation/fixtures.md).
Không tick thêm các AC đầy đủ từ fixture; Tag lookup B05, API thật B01..B06
theo case và Android/iOS T030..T032 vẫn Pending. Notification/Proposal/profile
giữ dependency và phạm vi riêng. Transport replay/không có exactly-once guarantee
được ghi trong evidence, không coi suite xanh là đảm bảo backend idempotency.

## Checkpoint để tiếp tục sau backend — 2026-10-12

153 tests/lint/typecheck/structure338 qua; rà lại source, guards và phạm vi commit.
Weekly UI/draft đã có nhưng chưa lưu API; T036/B08/GAP-09 pending. Các checkbox
AC/API/native phía trên giữ nguyên. Hướng dẫn tiếp tục tại [resume](resume.md).
