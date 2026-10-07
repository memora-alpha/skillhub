# SkillHub Logical Data Model v3

Mô hình v3 theo `SRS_SkillHub_V1.5.docx`, với các điều chỉnh phạm vi của người dùng; **không biểu diễn phần OTP trong v3**. Mô hình này cập nhật nghiệp vụ 1.4/1.5 còn thiếu trong v1; đây là thiết kế, chưa phải schema/migration hay runtime đã triển khai.

## Artifact và cách đọc

- `SkillHub_Conceptual_Data_Model_v3.drawio`: một canvas, 32 entity conceptual; giữ kiểu box trắng viền xanh, font và crow's-foot như v1, biểu diễn trực tiếp quan hệ nhiều–nhiều, ẩn các entity trung gian và bảng kỹ thuật version/join/credential.
- `SkillHub_Logical_Data_Model_v3.drawio`: một canvas, 49 định nghĩa chính: **48 bảng PostgreSQL, 1 document concept MongoDB**; giữ bảng trắng viền đen, tên bảng ở header, đường phân cách và field PK/FK/UQ/NN như v1.
- `SkillHub_Entities_Fields_v3.md`: danh mục field đồng bộ với logical diagram.
- `generate_data_models_v3.py`: sinh hai sơ đồ và field catalog; đọc catalog v1 làm baseline, không ghi đè artifact v1.

Mỗi entity/bảng xuất hiện đúng một lần trên cùng canvas, nối trực tiếp bằng crow's-foot như v1. Vị trí của các entity v1 còn được giữ lại; entity mới được bổ sung vào vùng mở rộng bên phải. Nhóm nghiệp vụ và store được ghi trong field catalog; tên document MongoDB có hậu tố `[MongoDB]` để phân biệt mà không đổi màu/format v1. Đường cross-store dùng nét đứt, là tham chiếu ứng dụng, không phải foreign key SQL.

## Thay đổi trình bày trong v3

V3 kế thừa toàn bộ field và ràng buộc logical của v2 (49 model: 48 PostgreSQL, 1 MongoDB). Chỉ conceptual bỏ entity trung gian dùng để biểu diễn quan hệ nhiều–nhiều, thay bằng cạnh trực tiếp với cardinality 0..N ở hai đầu:

| Entity ẩn khỏi conceptual | Quan hệ trực tiếp trong conceptual | Dữ liệu vẫn giữ ở logical |
|---|---|---|
| RolePermission | Role ↔ Permission: grants | Bảng nối quyền theo Role |
| SharingSkill | User ↔ Skill: offers | Level/status của kỹ năng tự khai; liên kết verification/evidence |
| UserLearnedSkill | User ↔ Skill: learned after path completion | Nguồn Path/Plan, thời điểm hoàn thành và rule grant |
| MaterialEntitlement | User ↔ Material: has access (FREE/PURCHASE) | Nguồn Order, trạng thái grant/revoke và thời điểm cấp quyền |

Hai cạnh User–Skill (offers và learned) có ý nghĩa khác nhau, không gộp. Cạnh User–Material sở hữu tài liệu vẫn là 1→N, độc lập cạnh N↔N quyền truy cập. SkillVerification/SkillEvidence nối trực tiếp User và Skill trong conceptual để giữ ngữ cảnh khi ẩn SharingSkill; logical vẫn tham chiếu SharingSkill. Quyền tải/nguồn mua và nguồn grant kỹ năng được giữ đầy đủ trong bảng logical, không suy ra chỉ từ cạnh conceptual.

MaterialOrder, HeldCreditAllocation và Review tiếp tục là entity conceptual vì biểu diễn giao dịch, khoản tiền giữ và đánh giá có vòng đời riêng. Các bảng kỹ thuật RolePermission, PathVersionPlan và SessionScheduleHistory vẫn tồn tại ở logical; PathVersionPlan/SessionScheduleHistory vốn đã ẩn ở conceptual v2. Không xóa bảng, field hoặc ràng buộc nghiệp vụ để đơn giản hóa sơ đồ conceptual.

V1 và v2 giữ nguyên; v3 được tạo thành bộ artifact riêng với generator `generate_data_models_v3.py`.

`PK`, `FK`, `UQ`, `NN` lần lượt là primary key, foreign key, unique và required. `REF` là tham chiếu ứng dụng. Crow's-foot thể hiện cardinality; các FK nullable dùng đầu `0..1`. Quan hệ bản nháp có thể 0..N; ràng buộc đúng số lượng được kiểm tra tại transition Confirm/Lock. Sơ đồ gom các relation cùng cặp bảng/role để tránh quá nhiều đường, còn khóa composite và rule đầy đủ nằm dưới đây.

Snapshot version, confirmation, outline, operation, settlement, schedule history, outbox và restriction là **lựa chọn thiết kế đề xuất**, không phải SRS bắt buộc từng tên bảng. Dữ liệu identity đã có được giữ theo trách nhiệm hiện tại; OTP nằm ngoài phạm vi sơ đồ v3. Theo người dùng, bỏ SkillTag và hai bảng nối LearningRequestTag/MaterialTag. Giữ SkillCategory và Skill; request/material dùng skillId hiện có để phân loại/lọc, không có tag bổ sung hoặc mảng tag thay thế. Đây là điều chỉnh phạm vi so với yêu cầu nhiều tag của SRS; DOCX nguồn giữ nguyên.

## 1. Ownership và đơn vị dữ liệu

| Store | Dữ liệu chính |
|---|---|
| PostgreSQL | User gồm account và hồ sơ/RBAC, refresh/reauth/avatar metadata, Skill/evidence, Proposal/Conversation, Path/Plan/schedule/session, wallet/ledger/payment, material/order/entitlement, review/reputation/report/audit/outbox. |
| MongoDB/Mongoose | Message có mảng attachments nhúng; ID PostgreSQL được application validate. Không có FK xuyên store. |

Timestamp dùng UTC. UUID cho relational IDs, UUID/string theo document/key contract. Secret/token plaintext không nằm trong bảng hoặc sơ đồ metadata. User là nguồn duy nhất cho dữ liệu account, tên hiển thị, hồ sơ và Reputation; không còn bảng Profile riêng.

**Quyết định của người dùng: gộp Profile vào User.** Chuyển fullName, headline, bio, avatarAssetId, timezone, locale, reputationScore (khởi tạo 50, CHECK 0–100), verifiedSkillCount và completedSessionCount sang `users`, giữ kiểu dữ liệu/nullability tương ứng. Chỉ một userId primary key và một updatedAt cho toàn bộ User; bỏ quan hệ User–Profile. AvatarAsset vẫn lưu metadata file riêng: `users.avatar_asset_id` nullable, FK đến AvatarAsset và kiểm tra asset.userId = users.userId bằng composite ownership constraint khi triển khai. Quan hệ chọn avatar là 0..1 hai phía; quan hệ sở hữu asset vẫn User → 0..N AvatarAsset.

API hồ sơ công khai chỉ project các field được phép, không trả toàn bộ bản ghi User chứa passwordHash, email riêng tư hoặc security metadata. Reputation và các counter do server quản lý, không cho cập nhật qua form hồ sơ. Việc gộp ở thiết kế chưa thay đổi endpoint/runtime; migration sau này phải backfill các field từ Profile, bảo toàn dữ liệu/điểm đã có và xử lý user thiếu hồ sơ trước khi áp NOT NULL.

**Quyết định bổ sung của người dùng: mỗi User có đúng một Role.** `users.role_id` là FK NOT NULL đến `roles.role_id`; không UNIQUE vì nhiều User có thể cùng Role. Bỏ entity/bảng `UserRole`/`user_roles`. Cardinality Role → User là 1 → 0..N; mỗi User tham chiếu đúng một Role USER/STAFF/ADMIN, Guest không lưu DB. Đăng ký gán USER phía server. `RolePermission` vẫn là bảng nối nhiều-nhiều Role/Permission; Staff không tự có quyền Admin. Đổi role phải có audit và cập nhật/revoke quyền truy cập phù hợp.

Khi triển khai migration từ runtime đa role, phải kiểm kê tài khoản có nhiều/không có role và giải quyết mapping trước NOT NULL; không tự chọn role cao nhất hoặc bỏ lịch sử grant. Công việc data model này chưa sửa RBAC runtime/Prisma hiện tại.

**Quyết định phạm vi của người dùng: bỏ Achievement.** V3 không có Achievement/UserAchievement, tiêu chí unlock hoặc selectedAchievementId trên User. Reputation, xác minh kỹ năng và trạng thái VERIFIED vẫn được giữ. DOCX SRS nguồn không được sửa; mô hình v3 ghi nhận điều chỉnh phạm vi này thay cho yêu cầu thành tích/danh hiệu trong SRS.

**Quy ước thiết kế v3: 100 integer units = 1 Credit.** Tất cả số tiền Credit dùng BIGINT units: wallet, allocation, ledger delta/after, proposed price, negotiated price, fee, order, payment Credit. Ví dụ 20 Credit = 2.000 units; 100,25 Credit = 10.025 units. VND và sizeBytes vẫn số nguyên không scale. Phải thống nhất API serialization/conversion trong feature spec; không đổi nghĩa các field runtime âm thầm. Rule tính rate/rounding chỉ dùng decimal/rational/integer, không dùng float nhị phân.

SRS chốt 1.000 VND = 1 Credit. Payment lưu snapshot conversionRate để đối soát; paymentAmount bội 1.000 VND mới chỉ là đề xuất của SRS, chưa tự đặt CHECK bắt buộc. Việc làm tròn top-up nếu không chia hết và phí phải được chốt trước bật tính năng phụ thuộc.

## 2. LearningPath và LearningPlan

`LearningPath` là thỏa thuận chung của hai participant; `LearningPlan` là lộ trình teacher tự tạo cho learner. Path quản lý cam kết Credit, version chung, lịch, hoàn tất và settlement. Plan quản lý skill/mục tiêu/nội dung buổi, teacher/learner, version nội dung và learner confirmation.

TWO_WAY có hai plan A→B và B→A; hai plan có thể khác skill/mục tiêu/số buổi. ONE_WAY có một plan teacher→learner. Các role này thuộc thỏa thuận/plan, không thêm Teacher/Learner vào account roles.

| Bảng | Khóa và ràng buộc bổ sung |
|---|---|
| `learning_paths` | A ≠ B; hai User đúng participant Conversation. currentVersion ≥1; current/locked version thuộc chính path. Không unique conversationId khi SRS chưa chốt số thỏa thuận/Conversation. |
| `learning_path_versions` | PK `(pathId, versionNo)`; snapshot bất biến. TWO_WAY totalCreditPerUser ≥2.000 units, teacherId/learnerId/negotiatedCredit null. ONE_WAY negotiatedCredit >0, totalCreditPerUser null; teacher/learner khác nhau, đúng A/B. feePolicyId trỏ một policy version bất biến; snapshot phải khớp policy khi chốt. |
| `learning_plans` | Unique `(pathId, teacherId, learnerId)`; createdBy = teacherId; teacher ≠ learner và thuộc path. Tối đa hai hướng trong draft; Confirm bắt buộc đúng 2 hướng TWO_WAY hoặc đúng 1 hướng ONE_WAY. Vai trò plan phải khớp loại/role PathVersion. Không cho actor tạo hộ đối phương. |
| `learning_plan_versions` | PK `(planId, versionNo)`; totalSessions ≥1, skill active khi đề xuất/chốt; goal 10–1500 ký tự. Không sửa snapshot đã được xác nhận hoặc Session đã học; tạo version mới. |
| `plan_session_outlines` | PK `(planId, planVersion, sessionNo)`; composite FK → PlanVersion; sessionNo từ 1..totalSessions, không thiếu/trùng; số outline đúng số buổi. |
| `path_version_plans` | PK `(pathId, pathVersion, planId)`; composite FK đến PathVersion và PlanVersion; plan phải thuộc path. Snapshot tập plan cố định khi A/B confirm. |

Path status: DRAFT, PROPOSED, PARTIALLY_CONFIRMED, CONFIRMED, SCHEDULED, ACTIVE, COMPLETED, CANCELLED, DISPUTED. Plan status: DRAFT, PROPOSED, CONFIRMED, NEEDS_REVISION. Confirm Path chỉ hợp lệ khi đủ số plan và learner confirmation cho toàn bộ snapshot.

`learning_plan_versions.learner_confirmed_at` nullable, chỉ learner của plan được xác nhận; `learning_path_versions.participant_a_confirmed_at` và `participant_b_confirmed_at` nullable, chỉ participant tương ứng được ghi. Timestamp do server tạo. Xác nhận thỏa thuận không thay xác nhận plan. Teacher/learner và A/B được giữ cố định trong vòng đời plan/path; thay vai trò sau Lock cần quy trình amendment đã chốt.

Sửa plan tạo PlanVersion mới, tăng PathVersion với mapping mới; các timestamp xác nhận trên version mới khởi tạo NULL, giữ nguyên lịch sử xác nhận version cũ. Sửa giá/loại/vai trò thỏa thuận cũng tăng PathVersion. totalSessions Path là tổng số buổi các plan của snapshot, suy ra từ version; không lưu một số độc lập dễ lệch. Snapshot nội dung bất biến; chỉ các trường xác nhận được cập nhật có điều kiện đúng actor/currentVersion, một lần và idempotent, trong transaction kiểm tra version để tránh race edit/confirm.

Sau Lock cần amendment có xác nhận lại và reconcile Hold; quy trình chi tiết còn mở. Không coi đổi giá/số buổi là reschedule, không tự cho đổi TWO_WAY↔ONE_WAY sau Lock.

## 3. Lịch và Session

| Bảng | Khóa và ràng buộc bổ sung |
|---|---|
| `schedule_proposals` | Thuộc một Path; currentVersion/appliedVersion FK đến version của chính proposal. Pending revision giữ appliedVersion cũ. |
| `schedule_versions` | PK `(scheduleProposalId, versionNo)`; composite FK `(pathId, pathVersion)` → PathVersion; path phải khớp ScheduleProposal. Không có totalHeldCreditPerUser; giá thuộc PathVersion. |
| `schedule_items` | Unique `(scheduleProposalId, scheduleVersion, planId, planVersion, sessionNo)`; composite FK đến ScheduleVersion và PlanSessionOutline. Plan/version nằm trong tập PathVersion của lịch. endAt > startAt, thời lượng 60–180 phút; mỗi outline có đúng một item trong lịch chốt. |
| `sessions` | Unique `(planId, planVersion, outlineSessionNo)`; composite FK → PlanSessionOutline, path khớp plan, teacher/learner khớp plan. Hai participant được suy ra từ role plan. start/end là projection lịch áp dụng, cập nhật cùng schedule history khi reschedule. |
| `session_schedule_history` | Unique scheduleItemId; mỗi item chốt áp dụng tối đa một Session. Unique `(sessionId, scheduleItemId)`; partial unique `sessionId WHERE supersededAt IS NULL`. Khi reschedule, đóng history cũ và thêm history mới trong cùng transaction. |

`schedule_versions` lưu `participant_a_confirmed_at`/`participant_b_confirmed_at` nullable theo đúng A/B của Path. Version mới khởi tạo NULL; chỉ actor tương ứng được ghi timestamp phía server, idempotent và kiểm tra current scheduleVersion/pathVersion trong transaction tại Confirm/Lock. Không sao chép xác nhận lịch cũ sang lịch mới.

`sessions` lưu hai nhóm `teacher_confirmation_status`/`teacher_confirmed_at`/`teacher_confirmation_note` và `learner_confirmation_status`/`learner_confirmed_at`/`learner_confirmation_note`. Actor suy ra từ teacherId/learnerId của Session, mỗi người chỉ cập nhật nhóm của mình. Chưa xác nhận thì status/time NULL; status có xác nhận phải khớp timestamp. Note tối đa 1.000 ký tự; vocabulary status/timeout theo feature policy, không tự đặt mặc định. Đủ hai xác nhận hoàn thành hợp lệ mới COMPLETED; attendance không thay thế xác nhận. Final confirmation và transition COMPLETED phải nguyên tử, retry không ghi đè thời điểm/note đã xác nhận.

Mapping phòng nằm trên `sessions`: `room_name` nullable nhưng UNIQUE khi có; `provider_room_id` và `room_metadata` nullable, tối đa một mapping phòng/Session. Chỉ participant được token theo join policy; không lưu secret/token trong metadata.

**Gộp SessionAttendance vào Session theo người dùng.** Session lưu `teacher_first_joined_at`, `teacher_last_left_at`, `teacher_attendance_seconds` và ba field tương ứng `learner_first_joined_at`, `learner_last_left_at`, `learner_attendance_seconds`. Timestamp nullable khi chưa quan sát; tổng thời gian BIGINT giây NOT NULL mặc định 0, CHECK ≥0. Khi có cả hai timestamp, lastLeft ≥ firstJoined; lastLeft chỉ là lần rời gần nhất đã ghi nhận, không biểu thị user hiện đang offline vì có thể đã vào lại.

Attendance là tổng hợp cho hai participant cố định, không còn bảng hoặc lịch sử từng lần vào/ra. Tổng thời gian là thời gian thực kết nối qua các lần reconnect, không lấy lastLeft−firstJoined (sẽ tính cả thời gian vắng); nhiều kết nối đồng thời của cùng user không cộng trùng. Chỉ cập nhật từ dữ liệu provider đã xác minh, mapping participant về teacherId/learnerId và phòng đúng Session. Khi triển khai phải chốt nguồn tổng thời gian/reconciliation và cơ chế webhook duplicate/out-of-order; sáu field tổng hợp không tự đủ để dedupe providerEventId hoặc dựng lại mọi khoảng kết nối. Không cộng thời gian lần nữa khi retry webhook. Attendance không thay xác nhận hoàn thành, không tự quyết định no-show/settlement. Runtime attendance chưa được triển khai trong thay đổi tài liệu này.

Reschedule cần hai confirmation hoàn tất trước giờ bắt đầu cũ ít nhất 60 phút; lịch mới cũng phải hợp lệ/conflict-free. Không đủ confirmation thì lịch cũ giữ nguyên. Giữ Session ID ổn định; không tạo Session hoặc HOLD lại cho mỗi lịch revision. Session COMPLETED không settlement theo buổi.

## 4. Credit, Hold, settlement và Payment

| Bảng | Khóa và ràng buộc bổ sung |
|---|---|
| `credit_wallets` | Một wallet/User; available/held/purchased/bonus không âm; walletVersion ≥0. Purchased/bonus là metadata nguồn, không được cộng thêm vào available+held như các ví độc lập. Chính sách phân bổ nguồn tiền khi tiêu còn phải định nghĩa ở feature Credit. |
| `held_credit_allocations` | Unique `(pathId, userId)`; composite FK `(pathId, lockedPathVersion)` → PathVersion. 0 ≤ remainingHeld ≤ amount. TWO_WAY hai allocation COMMITMENT của A/B; ONE_WAY một allocation TEACHING_PAYMENT của learner, beneficiary=teacher. Không có sessionId. |
| `fee_policy_versions` | Unique `(policyCode, versionNo)`; policy immutable sau approval. Policy code riêng TWO_WAY/ONE_WAY/MATERIAL_PAID; chốt method/rate/rounding/hiệu lực. Không default ONE_WAY/MATERIAL sang 4%. |
| `credit_operations` | IdempotencyKey unique, ràng buộc request fingerprint/reference để cùng key với payload khác bị từ chối. Parent operation gom mọi wallet entry của một hành động; SUCCESS chỉ commit cùng đầy đủ ledger và nghiệp vụ. |
| `credit_transactions` | Unique idempotencyKey và `(operationId, entryNo)`; userId → wallet userId; delta/after reconcile đúng wallet; reversal trỏ entry gốc. Thành công append-only, refund bằng entry mới. |
| Quyết toán trên `learning_paths` | settlementOperationId UNIQUE, FK → CreditOperation; composite FK `(pathId, settledPathVersion)` → PathVersion của chính path; settlementFeePolicyId FK → FeePolicyVersion. Chỉ ghi một settlement thành công/path. settlementGrossAmount là tổng Held tiêu thụ của các payer, settlementFeeAmount là tổng phí; settlementFeeSnapshot lưu fee/rounding và chi tiết theo payer nếu TWO_WAY. settlementExchangeType/policy/version phải khớp thỏa thuận đã chốt. |
| `payments` | Unique externalOrderRef; unique `(gateway, gatewayTransactionId)` khi có. PAID tạo tối đa một TOP_UP qua operation idempotent; conversionRate snapshot=1.000 VND/Credit. Verify gateway ở server, không tin redirect/client amount. |

Vocabulary CreditTransaction: TOP_UP, DAILY_BONUS, FEEDBACK_BONUS, HOLD, RELEASE, PATH_RETURN, PLATFORM_FEE, TEACHING_PAYMENT, TEACHING_EARNING, MATERIAL_PURCHASE, MATERIAL_SALE, REFUND, PENALTY, ADJUSTMENT. Reference nghiệp vụ nằm ở CreditOperation: PAYMENT, LEARNING_PATH, SESSION, REVIEW, DISPUTE, MATERIAL_ORDER, SYSTEM. Không WITHDRAWAL, SESSION_RETURN hoặc settlement chuẩn SESSION_EARNING.

**Gộp PathSettlement vào LearningPath theo người dùng.** Các field `settled_path_version`, `settlement_operation_id`, `settlement_fee_policy_id`, `settlement_exchange_type`, `settlement_gross_amount`, `settlement_fee_amount`, `settlement_fee_snapshot`, `settled_at` đều NULL trước quyết toán và phải có đầy đủ khi quyết toán thành công (CHECK cả nhóm cùng NULL hoặc cùng NOT NULL). Gross >0, 0 ≤ fee ≤ gross; đơn vị BIGINT vẫn là 1/100 Credit. Không còn settlementId hoặc bảng PathSettlement riêng.

Quyết toán phải khóa bản ghi Path, kiểm tra `settled_at IS NULL`, version/session/dispute/policy và cập nhật cả nhóm field cùng ledger/wallet/allocation/status trong một transaction. CreditOperation phải SUCCESS, referenceType LEARNING_PATH và referenceId đúng path. IdempotencyKey của operation và UNIQUE settlementOperationId kết hợp khóa/conditional update Path chống retry/concurrent settle trùng; UNIQUE operationId một mình không ngăn hai operation khác nhau cùng quyết toán một path. Khi đã settled, retry trả kết quả đã lưu; snapshot/time/version không ghi đè. Refund/đảo sau đó ghi operation/ledger mới, không xóa settlement để quyết toán lần hai. FeePolicy vẫn giữ model riêng.

TWO_WAY: mỗi payer nhận lại 96% Held của chính mình, phí 4%; returned = gross − roundedFee. Ví dụ 20 Credit/User trả 19,20 và phí 0,80/User. ONE_WAY: learner Held giảm gross; teacher Available tăng gross − fee; fee theo policy đã chốt. Không hoàn 96% về learner và teacher không cần đặt Credit.

PLATFORM_FEE không được debit payer thêm lần nữa nếu TEACHING_PAYMENT/MATERIAL_PURCHASE đã debit gross. Thiết kế ledger phải phân biệt entry accounting phí và biến động wallet, bảo đảm gross debit = net người nhận + fee. Bảng User không chứa tài khoản SYSTEM/Guest giả để nhận phí; phí được đối soát từ operation/settlement/order và entry theo contract Credit đã chốt.

## 5. Tài liệu số

| Bảng | Khóa và ràng buộc bổ sung |
|---|---|
| `materials` | owner ACTIVE và xác nhận quyền phân phối; title 5–150, description 10–3000; FREE price=0, PAID price>0. Lưu trực tiếp storageKey UNIQUE, originalFilename, mimeType, sizeBytes, checksum, scanStatus, distributionRightsConfirmedAt, uploadedAt. Các field file nullable ở draft; PUBLISHED cần đủ metadata, size dương và CLEAN. Metadata/giá/file đổi tăng listingVersion. Upload/MIME/size theo policy material riêng, không lấy giới hạn 15 MB chat. |
| `material_orders` | buyer ≠ seller, seller là owner; materialId FK → Material; unique idempotencyKey/operationId. gross >0, fee ≥0, net ≥0, gross=fee+net. Price/listingVersion/policy snapshot và purchasedFileSnapshot từ server; đổi snapshot trước commit yêu cầu confirm lại. PurchasedFileSnapshot bất biến, không có purchasedVersionId. |
| `material_entitlements` | Unique `(userId, materialId)`; unique sourceOrderId khi có. PURCHASE cần order SUCCESS cùng buyer/material; FREE sourceOrder null và không có debit/credit. Không có grantedVersionId/versionScope; quyền gắn với Material, file đã mua truy xuất từ snapshot của sourceOrder. Quyền tải file thay thế vẫn cần policy, chưa tự cấp mọi file mới. |

Theo quyết định của người dùng, bỏ model MaterialVersion và mọi FK phiên bản file. Material chỉ biểu diễn file hiện tại, không có catalog lịch sử phiên bản riêng. Để giữ chứng từ mua và file đã bán, MaterialOrder lưu `purchased_file_snapshot` JSON gồm `{storageKey, originalFilename, mimeType, sizeBytes, checksum, distributionRightsConfirmedAt, uploadedAt}` lấy từ Material trong transaction mua. Snapshot không phải FK hoặc model phiên bản mới. Không ghi đè/xóa object đã bán khi thay file hiện tại trong thời gian quyền còn hiệu lực; download vẫn phải kiểm tra quyền và trạng thái chặn/scan hiện hành của object, không dùng snapshot để vượt kiểm soát an toàn. Chính sách retention và quyền tải file thay thế cần chốt ở feature material.

Material status: DRAFT → PENDING_REVIEW → PUBLISHED hoặc REJECTED; vi phạm → HIDDEN; owner dừng phân phối → ARCHIVED. REJECTED cần reason. ModerationStatus/scanStatus là trạng thái riêng, chưa chốt toàn bộ enum chi tiết. Order/Entitlement status cần closed vocabulary theo feature policy; tối thiểu order SUCCESS và entitlement còn hiệu lực để authorize.

Mua PAID bằng Available, không tạo LearningPath/Hold. Trong một transaction: kiểm tra snapshot, status/CLEAN, entitlement, đủ số dư; debit buyer, credit seller/net, ghi fee/operation/order SUCCESS và grant entitlement. Retry hoặc request khác khi đã có quyền trả order/quyền cũ, không thu lại. Concurrent purchase phải phối hợp unique entitlement và khóa ví/material nhất quán.

Download luôn authorize owner/moderator có permission hoặc entitlement/FREE phù hợp, rồi cấp signed URL ngắn hạn. Share link chỉ chia sẻ metadata, không cấp PAID file. Tài liệu HIDDEN/ARCHIVED và quyền đã mua/new versions/refund vẫn cần policy, không dùng enum của thiết kế để tự quyết nghiệp vụ.

## 6. Moderation, review, reputation và report

| Bảng | Khóa và ràng buộc bổ sung |
|---|---|
| `learning_requests` | Moderation NOT_REQUIRED/PENDING/APPROVED/REJECTED; business status thêm PENDING_MODERATION/REJECTED. ContentVersion gắn approval, sửa nội dung phải kiểm tra lại; rejected reason 10–500. OPEN mới nhận proposal, cancel trực tiếp chỉ trước Lock. |
| `proposals` | sourceType LEARNING_REQUEST/DIRECT_SEARCH; requestId có khi nguồn request, null khi direct. Recipient khác proposer; request owner phải là recipient. Partial unique PENDING `(requestId, proposerId)` cho nguồn request. proposedDuration optional 60–180, proposedCredit suggestion theo exchangeType thương lượng, không tạo cam kết. |
| `skill_evidence` | Mỗi file PENDING/APPROVED/REJECTED/REVOKED, approval/reviewer và revoke reason/audit riêng. 1–5 file/submission. Approved không expiry tự động; đợt mới không thu hồi đợt cũ. Aggregate VERIFIED cần có evidence hợp lệ theo policy. |
| `reviews` | Unique `(pathId, reviewerId)`; reviewer/reviewee khác nhau và đúng A/B; rating 1–5; chỉ sau Path complete/settled. Áp dụng cả ONE_WAY; không tự giới hạn learner-only. |
| `user_learned_skills` | Unique `(userId, skillId, sourcePlanId)`; path khớp plan, user đúng learner và skill đúng version đã hoàn tất thỏa thuận. ONE_WAY teacher không tự được grant. |
| `reputation_history` | Score 0–100, reasonCode/source/ruleVersion và eventKey unique; delta là biến động thực sau clamp, scoreAfter=scoreBefore+delta. +1 completion/User, cap +10/tháng từ nguồn completion; chống event delivery trùng. |
| `user_restrictions` | start<end; scope biểu diễn hạn chế tạo request/proposal độc lập login/học lịch cũ; actor SYSTEM có thể null. Threshold/severity theo 18.34; lock account nghiêm trọng phối hợp Account state. |
| `report_cases` | RelatedPath/Session/Transaction/Material/Order optional có kiểm tra consistency. MATERIAL/MATERIAL_ORDER không bắt buộc path/session. Target existence/ownership theo type; case giữ Credit được đánh dấu/quyết định blocksSettlement có audit. Resolve cần handler/reason/time và entry đối ứng khi thay Credit. |
| `outbox_events` | EventId và dedupeKey unique; publisher/consumer idempotent, bounded retry; payload không có token/storage secret. Critical audit cùng transaction nghiệp vụ; delivery ngoài DB sau commit. |

Reputation khởi tạo 50 theo SRS, CHECK 0–100. Điểm hiện có có lịch sử không được reset khi migration; null chỉ backfill sau kiểm tra. Timed restriction không thay toàn bộ thành Account LOCKED khiến user mất quyền tham gia lịch đã chốt trái policy.

Report target bổ sung MATERIAL/MATERIAL_ORDER, chuẩn hóa CREDIT_TRANSACTION thay TRANSACTION cũ theo API migration; USER/SESSION/MESSAGE/REVIEW/LEARNING_REQUEST vẫn được giữ. ReasonCode theo 18.37, OTHER cần mô tả. Polymorphic targetId có thể string để hỗ trợ MongoDB; nullable direct relational FKs giúp truy vấn/audit nhưng phải reconcile với target.

## 6.1. Dữ liệu nhúng trong model cha

`learning_requests.preferred_slots` và `proposals.candidate_slots` là mảng JSON NOT NULL, mặc định `[]`, tối đa 5 phần tử `{startAt, endAt}`. Mỗi khoảng dùng UTC, startAt < endAt; validate cấu trúc/giới hạn ở ứng dụng, CHECK JSON array/count ở PostgreSQL khi triển khai. Đây chỉ là gợi ý thương lượng, không tạo lịch chính thức, Session hoặc Hold.

`messages.attachments` là mảng subdocument MongoDB, mặc định `[]`, không có collection Attachment riêng. Mỗi phần tử gồm `attachmentId`, `mimeType`, `storageKey`, `fileSizeBytes`, `scanStatus`, `checksum`; giữ attachmentId ổn định và duy nhất trong message. Validate metadata bắt buộc, size dương và tối đa 15 MB/file, scan status và quyền truy cập file; authorize qua Conversation của Message khi download. Không có messageId riêng trong phần tử vì document cha đã xác định ownership. Mảng nhúng chỉ chứa metadata; file vẫn ở object storage, không đưa bytes/token vào Message. Giới hạn số attachment/tổng dung lượng message phải chốt ở feature chat, không tự suy ra từ giới hạn mỗi file.

## 7. Transaction boundaries và kiểm chứng cần có

1. **Accept Proposal:** lock/check Proposal/Request và hai account; cập nhật trạng thái, tạo Conversation nhất quán. Không Hold/tạo Session.
2. **Confirm/Lock:** kiểm tra version Path/Plan và confirmations, lịch/conflict/account, wallet payer; atomically tạo HOLD/allocation, update ví/ledger, apply schedule và tạo Session. Race edit với final confirm phải bị từ chối khi version stale.
3. **Complete Path:** tất cả Session của snapshot plan COMPLETED, không dispute giữ Credit, policy và window hợp lệ; ghi các field quyết toán trực tiếp trên LearningPath, ledger/wallet/allocation và Path COMPLETED cùng commit. Khóa Path/check settledAt để chỉ quyết toán một lần. Learned skill/reputation cập nhật qua owner contracts và event idempotent nếu là projection sau commit.
4. **PAID purchase:** kiểm tra giá/version/quyền/số dư/CLEAN, order+operation+debit/credit/fee+entitlement cùng commit; rollback không cấp quyền. Lock order/material/user ví theo thứ tự ổn định.
5. **Dispute/refund:** decision/audit, ledger đối ứng, Hold release hoặc entitlement revoke theo policy trong transaction; không sửa successful history.

Các scenario cần kiểm chứng thực khi triển khai: plan thiếu/self-confirm/stale version; teacher ONE_WAY 0 Credit; reschedule giữ ID/lịch cũ và không Hold lại; complete từng Session chưa settle; duplicate/out-of-order settlement; material mua lại/concurrent/đổi giá-file/refund; check entitlement mỗi download; wallet không âm và ledger bảo toàn Credit.

## 8. Điểm còn mở

- Phí/min-max/rounding/cancel/no-show ONE_WAY và phí/refund/dispute/upload/retention material theo OP-13/14; không default 4%/20 Credit cho luồng mới.
- TWO_WAY totalCreditPerUser hiện bám một mức chung; mức A/B khác nhau chưa được SRS cho phép rõ.
- Amendment sau Lock, reconciliation tăng/giảm Hold, quyền đổi loại/vai trò và số buổi; bảo toàn Session đã học.
- Quyền tải file thay thế sau khi mua, retention object đã bán và quyền khi HIDDEN/ARCHIVED/revoked/refunded; policy re-purchase khi đã có entitlement bị revoke.
- Confirm completion timeout, dispute window, bonus, join window, Staff permissions và số thỏa thuận/Conversation.
- SRS 18.13 vẫn ghi skill/goal chung Path bắt buộc trong khi 18.32/39 đặt ở Plan; v3 lấy PlanVersion làm nguồn. PP-005 vẫn đặt giá ở ScheduleProposal; v3 lấy PathVersion làm nguồn.
- Phí cần snapshot khi chốt; đề xuất policy có trước Lock để user biết giá cuối, timing gate cần acceptance cụ thể.

## 9. Phạm vi cập nhật và validation artifact

Đã gộp 8 model vào cha: PlanConfirmation → LearningPlanVersion, PathConfirmation → LearningPathVersion, ScheduleConfirmation → ScheduleVersion, SessionConfirmation và LiveKitRoom → Session, RequestPreferredSlot → LearningRequest, ProposalCandidateSlot → Proposal, MessageAttachment → Message. Logical giảm 64 xuống 56 model; conceptual giảm 44 xuống 41 entity. PlanSessionOutline và SessionAttendance vẫn giữ. Đây là thay đổi cấu trúc thiết kế, không bỏ yêu cầu xác nhận, lịch sử hoặc kiểm soát file.

Tiếp tục bỏ MaterialVersion theo quyết định của người dùng: file metadata về Material, snapshot file đã mua về MaterialOrder, loại các FK phiên bản khỏi Material/Order/Entitlement. Tổng hiện tại: 55 model logical (54 PostgreSQL, 1 MongoDB), 40 entity conceptual; format v1 giữ nguyên.

Quyết định mới nhất: gộp Profile vào User, chuyển toàn bộ field hồ sơ/Reputation/counter và quan hệ chọn AvatarAsset sang User; bỏ entity Profile và FK User–Profile. Tổng hiện tại: 54 model logical (53 PostgreSQL, 1 MongoDB), 39 entity conceptual. Prisma/runtime/migration chưa thay đổi.

Tiếp tục gộp PathSettlement vào LearningPath, chuyển dữ liệu và quan hệ quyết toán version/policy/operation sang Path. Tổng mới nhất: 53 model logical (52 PostgreSQL, 1 MongoDB), 38 entity conceptual. Giữ FeePolicy, ledger và cơ chế một final settlement/path; chưa sửa Prisma/runtime/migration.

Quyết định mới nhất: bỏ SkillTag cùng LearningRequestTag/MaterialTag và các quan hệ tag. Giữ SkillCategory/Skill và skillId hiện có trên Request/Material, không tự thêm cơ chế nhiều tag khác. Tổng hiện tại: 50 model logical (49 PostgreSQL, 1 MongoDB), 37 entity conceptual. Chưa sửa Prisma/runtime/migration.

Tiếp tục gộp SessionAttendance vào Session thành sáu field attendance tổng hợp cho teacher/learner, bỏ entity và các quan hệ attendance riêng. Tổng mới nhất: 49 model logical (48 PostgreSQL, 1 MongoDB), 36 entity conceptual. Không lưu lịch sử từng lần vào/ra; xác nhận hoàn thành Session vẫn giữ độc lập. Chưa sửa Prisma/runtime/migration.

V3 chỉ đổi trình bày conceptual: ẩn RolePermission, SharingSkill, UserLearnedSkill, MaterialEntitlement và thay bằng quan hệ N↔N trực tiếp. Tổng v3: 32 entity conceptual; logical vẫn 49 model (48 PostgreSQL, 1 MongoDB), field/quan hệ/ràng buộc logical giữ nguyên v2. Generator kiểm tra đủ các cạnh thay thế, bảng logical vẫn tồn tại và hash artifact v1/v2 không đổi.

Giữ nguyên artifact v1 và DOCX nguồn. Loại Withdrawal và UserRole khỏi v3; User có một roleId bắt buộc; loại các entity OTP và tham chiếu challenge khỏi sơ đồ v3 theo người dùng. Việc bỏ khỏi tài liệu không tắt hoặc thay đổi OTP runtime. Prisma, constitution, source API, deployment schema/migration chưa được thay đổi trong công việc này. Khi triển khai, cập nhật RBAC spec/contracts và migration role theo phạm vi được yêu cầu riêng.

Generator kiểm tra coverage domain, edge endpoint, ID uniqueness, geometry không chồng box, absence OTP/Withdrawal/sessionCredit, Hold/Review cấp Path và SHA-256 artifact v1 không đổi. Preview hình học của hai canvas được tạo và kiểm tra; đây không phải renderer draw.io chính thức, chưa chứng minh vị trí label/routing cuối cùng trong editor. Không chạy backend tests vì chưa sửa runtime/schema.

Chạy lại từ repository root bằng Python có Pillow:

```powershell
python docs/generate_data_models_v3.py
```

Nếu chuyển sang môi trường khác, dùng Python có Pillow và điều chỉnh font path của preview; phần XML draw.io không phụ thuộc database/provider.
