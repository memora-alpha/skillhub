# Specification Quality Checklist: Credit & Payment

**Purpose**: Review bản đặc tả nền tảng trước implementation planning.
**Created**: 2026-10-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] User stories và yêu cầu tập trung giá trị/hành vi nghiệp vụ.
- [x] Không chỉ định framework, ngôn ngữ hoặc route trong yêu cầu nghiệp vụ.
- [x] Các section bắt buộc của spec template đã hoàn thành.
- [x] SRS hiện hành và giới hạn backend được nêu rõ.

## Requirement Completeness

- [x] Không còn marker NEEDS CLARIFICATION; phần chưa được duyệt được tách thành activation gates có ảnh hưởng rõ ràng.
- [x] Requirements có điều kiện test được; có acceptance cho từng user story.
- [x] Success criteria đo được và không phụ thuộc công nghệ triển khai.
- [x] Có edge cases concurrency, retry, crash, precision, quyền, late delivery và đối soát.
- [x] Có dependencies/assumptions, ranh giới owner và traceability SRS.

## Feature Readiness

- [x] Đủ đầu vào thiết kế phần nền tảng Credit và port Payment chung.
- [x] Provider đã chọn: payOS; REST create/signed response/webhook/lookup contract được đối chiếu tài liệu chính thức trong contracts/gateway.md.
- [x] User xác nhận floor phí 4%, phần còn lại cho người nhận ngày 2026-10-15.
- [ ] Merchant configuration, các điểm contract cần channel kiểm chứng và toàn bộ integration runtime đã hoàn tất.
- [ ] Toàn bộ chính sách bổ sung đã chốt: [policies.md](../policies.md) còn gate.
- [ ] Đủ bằng chứng runtime cho toàn feature: initial wallet/PG/HTTP đã kiểm, Payment posting/provenance/payOS channel/load còn Pending; [validation.md](../validation.md).

## Notes

Review 2026-10-15: draft đủ để lập thiết kế có giới hạn. Không coi không có marker là đã chốt provider, bonus, buckets, refund hoặc quyền Staff. Chỉ các nhánh không phụ thuộc gate được triển khai; không đánh dấu toàn feature Ready for production.
