# Skills catalog Sharing Skill và evidence

## Nguồn và ba chiều hiện trạng

Working tree HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd: [backend skills HTTP](../../../../services/api/specs/007-skills/contracts/http.md), [level amendment](../../../../services/api/specs/007-skills/skill-level-catalog.md), [skills controllers](../../../../services/api/src/modules/skills/presentation/http), [sharing controllers](../../../../services/api/src/modules/sharing-skills/presentation/http), [verification controllers](../../../../services/api/src/modules/verifications/presentation/http). Mobile [skills-api](../../src/features/skills/api/skills-api.ts), [contract parsers](../../src/features/skills/api/skill-contracts.ts), [profile rows](../../src/features/skills/components/ProfileSkillRows.tsx).

Backend có source (HTTP tài liệu từng mang nhãn planned); mobile có API CRUD/catalog/public/evidence/history/download; real User/API/scanner/native acceptance còn thiếu theo [checklist004](../../specs/004-skills-management/checklist.md). Không dùng Admin catalog test thay mobile User acceptance.

## Routes base /api/v1

| Method/path                                      | Auth/input                                                                          | Output                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| GET /skills, /skills/:skillId                    | Catalog public; mobile dùng shared auth client; list q2–100,categoryId,cursor,limit | ACTIVE catalog page/detail                                    |
| GET /skills/:skillId/levels                      | Skill UUID; ACTIVE                                                                  | Nonpaginated array, order sortOrder/id                        |
| GET /me/skills                                   | Owner; includeArchived=false,cursor                                                 | Owner page; true nếu dùng thì gồm mọi bản, không chỉ archived |
| POST /me/skills                                  | Owner; skillId,levelId,description,experienceYears?,isVisible?                      | 201 own DTO                                                   |
| PATCH /me/skills/:id                             | Owner; changed editable fields + expectedVersion, không skillId                     | 200 own DTO                                                   |
| POST /me/skills/:id/archive                      | Owner; expectedVersion                                                              | 200 archived DTO;409 nếu batch PENDING                        |
| POST /me/skills/:id/restore                      | Backend có owner command/version/key                                                | Ngoài phạm vi mobile004, không có UI restore                  |
| GET /profiles/:userId/skills                     | Public projection; mobile dùng authenticated client                                 | Page visible/nonarchived/ACTIVE account/catalog               |
| POST /me/skills/:id/evidence-files               | Owner; multipart một field file                                                     | 202 fileId/state QUARANTINED                                  |
| GET /me/skills/:id/evidence-files/:fileId        | Owner đúng skill/file                                                               | Storage state, READY cần trước submit                         |
| POST /me/skills/:id/verifications                | Owner;1–5 distinct fileIds,title0–120?,description0–500?                            | 201 PENDING batch                                             |
| GET /me/skills/:id/verifications                 | Owner,cursor/limit                                                                  | History page                                                  |
| GET /me/skills/:id/verifications/:verificationId | Owner                                                                               | Batch detail/files/reasons                                    |
| GET /me/skills/:id/evidence/:evidenceId/download | Owner, file READY                                                                   | Short-lived url/expiresAt                                     |

JSON mutations cần Idempotency-Key, edit/archive expectedVersion. Retry cùng operation/body giữ key; body/version đổi là intent mới. Confirmed DTO phải đúng target/skill/level binding. Multipart không replay tự động sau renewal; explicit retry có thể tạo fileId mới. Các lỗi dùng400/401/403/404/409/413/415/429/503; không đoán503 là scan/timezone/storage cụ thể khi message bị mask.

List data[] + meta.pagination {limit,hasMore,nextCursor}; limit1–50/default20. Cursor opaque/filter bound. Không có own Sharing Skill detail endpoint: findOwn đi qua active owner pages, chặn cursor loop. Public detail cũng đi qua target public pages; không owner fallback/history/evidence kể cả self. Public DTO allowlist loại owner metadata/reasons/files. Archive/hide confirmed loại matching public detail cache.

## Field enum và upload semantics

Description20–1500; experienceYears decimal string/null0–60 với1 chữ số thập phân. Create/change level gửi levelId từ đúng skill ACTIVE catalog; PATCH bỏ levelId để giữ selection cũ INACTIVE. Projection level là open string, levelId/skillLevel nullable/legacy; hiển thị skillLevel.name/description, fallback legacy label khi metadata thiếu hợp lệ. currentLevel của Learning Request là enum độc lập, không chuyển theo level catalog.

Owner Sharing Skill có skill,isVisible,archivedAt,version,latestVerification. latestVerification là summary raw batch, không phải detail có files. Badge: UNVERIFIED/PENDING/VERIFIED/REJECTED; batch: PENDING/APPROVED/REJECTED; evidence approval: PENDING/APPROVED/REJECTED/REVOKED. Storage READY riêng với expertise approval và avatar CLEAN. VERIFIED có thể cùng batch PENDING mới. Backend trả aggregate, mobile không tính từ một trang history; approved evidence không tự expiry.

Evidence PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP,1–5 files. Hard ceiling hiện tại10_000_000 bytes/file, config server có thể nhỏ hơn; chưa có client config endpoint. Giữ MIME/name/byte validation, không reuse avatar/chat cap. SubmittedAt/reviewedAt là server ISO instant; hiển thị Asia/Ho_Chi_Minh với nhãn giờ Việt Nam, không cộng/trừ7 giờ vào instant. Evidence projection chưa có uploadedAt, không dùng submittedAt làm giờ upload.

## Lifecycle hiện có

Save xác nhận skill trước rồi queue evidence theo skillId/session, về list; Send queue rồi về detail. Draft/fileIds/submit intent chỉ trong session, tiếp tục qua navigation, pause background cho explicit retry, logout/archive loại job đúng scope; không phục hồi sau process kill. Không mutation tự resume. Hai worker prepare/upload, đợi in-flight upload settle trước unlock lỗi. Poll scan48 reads/file, báo chậm sau24; hết budget còn scan thì WAITING_SCAN/Check again giữ ID, chỉ READY submit. Thực thi chi tiết tại [upload guide](../guides/uploads-and-realtime.md) và source được dẫn, không biến cadence UI thành SLA scanner.

Confirmed create/edit/visibility/submit lưu DTO vào scoped caches trước refetch, không rollback saved result khi đọc lỗi, không đè version mới. History decision chỉ gỡ snapshot đúng batch/version rồi refetch badge/account; decision riêng không đủ aggregate. Image preview xin URL mới, giữ component state đến blur/background/expiry, không public cache. UI delete là “Xóa kỹ năng” (archive); không archived toggle/detail, giữ history server.

## Chênh lệch và việc cần xác minh

| Nguồn/yêu cầu                         | Source/contract hiện tại                       | Giữ giới hạn                                                         |
| ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| SRS SK-002 material-change policy     | Service chưa reset badge theo edit             | Không tự revoke/reset client; cần policy owner                       |
| HTTP có mô tả INACTIVE public lịch sử | Repository lọc catalog ACTIVE                  | Không ghép owner data để public lại                                  |
| Newest-first toàn bộ dữ liệu          | Owner API UUID order, thiếu createdAt/sort     | Chỉ ưu tiên confirmed creates trong phiên; GAP-09 chưa đóng          |
| SRS cap theo config                   | Hard ceiling và server có thể chặt hơn         | Handle413/503; không quảng cáo fixed SRS cap                         |
| Catalog thật đã có dữ liệu            | Admin/public read từng được ghi nhận2026-10-15 | Chưa chứng minh User/mobile CRUD, scan READY/Staff decision/download |

[Spec004](../../specs/004-skills-management/spec.md), [tasks](../../specs/004-skills-management/tasks.md), [validation](../../specs/004-skills-management/validation.md) giữ FR/AC và bằng chứng lịch sử. Kết quả296 tests/web/native JS exports ngày2026-10-15 là kết quả được ghi nhận ở lần chạy trước. Native picker/keyboard/Back/font, compression quality/EXIF/background và full API/storage/scanner vẫn mở; upload thật503 trước đó không xác định nguyên nhân bằng health200. Không tạo work thứ hai hoặc tick các AC trong migration.
