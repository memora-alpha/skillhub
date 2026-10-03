# Danh mục entity và field của SkillHub

## Phạm vi và cách đọc

Tài liệu này được tổng hợp từ `SRS_SkillHub_V1.3.docx` (đặc biệt mục 5, 8, 9, 18 và phụ lục B) cùng `rule&flow.png`. Tại thời điểm lập tài liệu, thư mục chỉ có SRS và ảnh, không có source code hay database schema. Vì vậy đây là **mô hình dữ liệu theo đặc tả**, không phải kết quả kiểm kê những bảng đã được triển khai.

- **[SRS]**: tên entity hoặc field được SRS nêu trực tiếp. Tên field có thể xuất hiện ở form, API hoặc mô tả nghiệp vụ; việc đặt nó vào bảng DB cần được xác nhận khi thiết kế vật lý.
- **[Đề xuất]**: field/entity cần để hiện thực quan hệ, audit hoặc quy tắc của SRS nhưng tài liệu chưa đặt tên/cấu trúc chính thức.
- ID nghiệp vụ nên dùng UUID/ULID do backend sinh; timestamp lưu UTC; Credit và tiền VND dùng số nguyên. Các bảng quan trọng nên có `createdAt`, `updatedAt` và cơ chế lưu lịch sử/ẩn phù hợp, nhưng không mặc định thêm chúng vào mọi bảng nếu SRS chưa chốt.
- Những tên nối bằng `/` trong mục 9.2 SRS là các lựa chọn/gộp khái niệm. Tài liệu này tách khi cần để thấy rõ trách nhiệm dữ liệu.

## 1. Tài khoản và phân quyền

### 1.1. User [SRS]

**Chức năng:** tài khoản đăng nhập và chủ thể của mọi hoạt động học/chia sẻ. Không tách User thành Teacher và Learner cố định.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `userId` | UUID/ULID, backend sinh, khóa chính | SRS |
| `email` | string 5–254, trim/lowercase, unique không phân biệt hoa thường | SRS |
| `passwordHash` | hash Argon2id/bcrypt; không lưu password rõ | Đề xuất tên cột từ rule SRS |
| `accountStatus` | `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `LOCKED`, `DEACTIVATED` | SRS |
| `emailVerified` | boolean; mặc định `false` khi đăng ký email | SRS |
| `failedLoginCount` | integer; khởi tạo 0, reset khi đăng nhập thành công | SRS |
| `lastLoginAt` | datetime nullable | SRS |
| `termsVersion` | phiên bản điều khoản đã chấp thuận | SRS |
| `termsAcceptedAt` | datetime chấp thuận điều khoản | SRS |
| `createdAt`, `updatedAt` | datetime UTC, backend sinh | SRS |

`fullName`, `timezone`, `locale` được nhập khi đăng ký nhưng cũng được SRS đặt trong Profile. Nên có một nguồn dữ liệu chuẩn cho các giá trị này, tránh lưu trùng không đồng bộ. Role `USER` được gán tự động sau đăng ký; Guest không phải tài khoản hay role lưu DB.

### 1.2. Role [SRS]

**Chức năng:** định nghĩa vai trò nghiệp vụ `USER`, `STAFF`, `ADMIN`.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `roleId` | UUID/ULID, khóa chính | Đề xuất |
| `name` | mã role duy nhất | Đề xuất |
| `description` | diễn giải phạm vi role | Đề xuất |

### 1.3. Permission [SRS]

**Chức năng:** kiểm soát quyền chi tiết, đặc biệt vì Staff không mặc định kế thừa mọi quyền Admin.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `permissionId` | UUID/ULID, khóa chính | Đề xuất |
| `code` | mã quyền duy nhất | Đề xuất |
| `description` | mô tả hành động được phép | Đề xuất |

Quan hệ Role–Permission là nhiều-nhiều; nếu dùng mô hình quan hệ cần bảng nối `RolePermission(roleId, permissionId)` **[Đề xuất]**.

### 1.4. UserRole [SRS]

**Chức năng:** gán vai trò cho User và phục vụ kiểm soát thay đổi quyền.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `userId` | FK → User | Đề xuất |
| `roleId` | FK → Role | Đề xuất |
| `assignedAt` | thời điểm gán | Đề xuất |
| `assignedBy` | User/Admin hoặc SYSTEM thực hiện | Đề xuất |

Thay đổi role phải có AuditLog. User không tự gán STAFF/ADMIN.

### 1.5. Profile [SRS]

**Chức năng:** thông tin hiển thị công khai và thống kê của User.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `userId` | FK → User, một Profile cho một User | Đề xuất |
| `fullName` | string 2–100; Unicode; không cần unique | SRS |
| `headline` | string 0–120 | SRS |
| `bio` | string 0–1000; sanitize chống XSS | SRS |
| `avatar` | ảnh JPG/PNG/WebP, tối đa 5 MB; DB nên giữ storage key/metadata | SRS |
| `timezone` | IANA timezone; bắt buộc sau setup | SRS |
| `locale` | `vi`/`en`, mặc định `vi` | SRS |
| `reputationScore` | integer 0–100, hệ thống tính | SRS |
| `verifiedSkillCount` | integer ≥0, hệ thống tính | SRS |
| `completedSessionCount` | integer ≥0, hệ thống tính | SRS |

`accountStatus` xuất hiện trên màn hình Profile nhưng thuộc User. Email đăng nhập và dữ liệu thanh toán không hiển thị công khai. Ba chỉ số hệ thống có thể được lưu dạng cache hoặc tính từ dữ liệu gốc; cần chọn một cách nhất quán.

### 1.6. OtpChallenge [Đề xuất từ luồng SRS]

**Chức năng:** xác minh email, đổi email, quên/đặt lại mật khẩu bằng OTP dùng một lần.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `challengeId` | UUID/ULID | Đề xuất |
| `userId`/`email` | tài khoản/email đích | Đề xuất |
| `purpose` | `REGISTER`, `RESET_PASSWORD`, `CHANGE_EMAIL` | SRS |
| `otpHash` | hash/secret; không lưu OTP rõ | Đề xuất từ rule SRS |
| `expiresAt`, `usedAt` | thời hạn và thời điểm dùng | Đề xuất từ rule SRS |
| `failedAttempts`, `resendCount`, `lastSentAt` | giới hạn nhập sai/resend | Đề xuất từ rule SRS |

OTP đăng ký mặc định hết hạn sau 5 phút, tối đa 5 lần nhập sai/challenge, resend cách nhau tối thiểu 60 giây và tối đa 5 lần/giờ/email; các ngưỡng phải là cấu hình.

### 1.7. OAuthAccount [Đề xuất từ luồng SRS]

**Chức năng:** liên kết tài khoản Google với User hiện có mà không tạo trùng User.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `userId` | FK → User | Đề xuất |
| `provider` | ví dụ `GOOGLE` | Đề xuất |
| `providerAccountId`/`googleSub` | ID duy nhất từ provider | SRS |
| `linkedAt` | thời điểm liên kết | Đề xuất |

### 1.8. RefreshSession [Đề xuất từ rule SRS]

**Chức năng:** quản lý refresh token, rotation và revoke khi logout/reset password.

Field đề xuất: `sessionId`, `userId`, `refreshTokenHash`, `expiresAt`, `revokedAt`, `createdAt`. Không lưu refresh token dạng rõ.

## 2. Kỹ năng và xác minh

### 2.1. Skill [SRS]

**Chức năng:** Skill Catalog chuẩn để Sharing Skill, Learning Request và lịch sử Session cùng tham chiếu.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `skillId` | UUID/ULID, khóa chính | Đề xuất từ quan hệ SRS |
| `name` | string 2–100; unique sau chuẩn hóa | SRS |
| `slug` | lowercase, URL-safe, unique | SRS |
| `categoryId` | FK → SkillCategory nếu có phân nhóm | SRS |
| `description` | string 0–500 | SRS |
| `status` | `ACTIVE`, `INACTIVE`, `ARCHIVED` | SRS |

Không xóa vật lý Skill đã được tham chiếu. Skill không ACTIVE không dùng để tạo Request/Sharing Skill mới.

### 2.2. SkillCategory [Đề xuất, tùy chọn]

**Chức năng:** phân nhóm Skill nếu triển khai `categoryId` được SRS nêu.

Field đề xuất: `categoryId`, `name`, `slug`, `status`, `parentCategoryId` nếu cần phân cấp. SRS chưa chốt cấu trúc danh mục này.

### 2.3. UserSkill / SharingSkill [SRS]

**Chức năng:** kỹ năng User công bố có thể hướng dẫn; đây là kỹ năng tự khai, chưa đồng nghĩa đã xác minh.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `sharingSkillId` | UUID/ULID, khóa chính | Đề xuất từ tham chiếu SRS |
| `userId` | FK → User/chủ kỹ năng | Đề xuất từ quan hệ SRS |
| `skillId` | FK → Skill ACTIVE | SRS |
| `level` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT` | SRS |
| `description` | string 20–1500 | SRS |
| `experienceYears` | decimal 0–60, tối đa 1 chữ số thập phân | SRS |
| `verificationStatus` | `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED` | SRS |
| `isVisible` | boolean, mặc định true | SRS |
| `archivedAt` | thời điểm ẩn/lưu trữ nếu đã có tham chiếu lịch sử | Đề xuất từ rule SRS |

Một User không có hai Sharing Skill active cùng `skillId`.

### 2.4. SkillEvidence [SRS]

**Chức năng:** lưu metadata của ảnh/PDF/chứng chỉ dùng chứng minh Sharing Skill; file không public mặc định.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `evidenceId` | UUID/ULID, khóa chính | Đề xuất |
| `sharingSkillId` | FK → SharingSkill | SRS |
| `verificationRequestId` | FK → SkillVerification | SRS |
| `evidenceTitle` | string 0–120 | SRS |
| `evidenceDescription` | string 0–500 | SRS |
| `fileType`/`mimeType` | JPG/JPEG/PNG/PDF | SRS nêu file type, đề xuất tên cột |
| `storageKey`/`url` | vị trí lưu file có kiểm soát truy cập | SRS nêu storage key/URL |
| `fileSize` | tối đa 10 MB/file | Đề xuất metadata từ validation SRS |
| `uploadedAt` | datetime UTC | Đề xuất |

Một lần gửi 1–5 file; kiểm tra MIME thực, phần mở rộng và malware.

### 2.5. SkillVerification [SRS]

**Chức năng:** yêu cầu và quyết định duyệt kỹ năng của Staff/Admin.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `verificationRequestId` | UUID/ULID | SRS |
| `sharingSkillId` | FK → SharingSkill | SRS |
| `status` | `PENDING`, `VERIFIED`/approved, `REJECTED`; cần chốt enum riêng | SRS ở mức trạng thái kỹ năng |
| `reviewerId` | Staff/Admin quyết định | SRS |
| `reviewedAt` | datetime UTC | SRS |
| `note` | ghi chú khi duyệt | SRS |
| `rejectReason` | 10–500 ký tự, bắt buộc khi reject | SRS |
| `submittedAt` | thời điểm gửi yêu cầu | Đề xuất |

Không có nhiều yêu cầu PENDING đồng thời cho một Sharing Skill. Mọi approve/reject sinh AuditLog.

### 2.6. UserLearnedSkill [Đề xuất từ rule SRS và ảnh]

**Chức năng:** ghi nhận User đã học kỹ năng khi hoàn thành điều kiện của toàn bộ lộ trình/thỏa thuận; không cấp badge `VERIFIED`.

Field đề xuất: `userId`, `skillId`, `scheduleProposalId` hoặc mã thỏa thuận, `completedAt`, `completionRuleVersion`. Có thể hiện thực bằng bảng riêng hoặc projection có thể tái tạo từ các Session hoàn thành.

## 3. Nhu cầu học, đề nghị và thương lượng

### 3.1. LearningRequest [SRS]

**Chức năng:** bài đăng nhu cầu học một Skill của User.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `learningRequestId` | UUID/ULID, khóa chính | Đề xuất |
| `ownerId` | FK → User/người đăng | Đề xuất từ quan hệ SRS |
| `title` | string 10–120 | SRS |
| `skillId` | FK → Skill ACTIVE | SRS |
| `description` | string 20–3000, sanitize | SRS |
| `learningGoal` | string 10–1000 | SRS |
| `currentLevel` | `NONE`, `BEGINNER`, `INTERMEDIATE`, `ADVANCED` | SRS |
| `expectedDurationMinutes` | integer 30–240, bước 30 | SRS |
| `budgetCredit` | integer ≥ `MIN_SESSION_CREDIT` nếu nhập; chưa Hold | SRS |
| `preferredSlots` | tối đa 5 khoảng tương lai, `end > start` | SRS |
| `verifiedTeacherOnly` | boolean, mặc định false | SRS |
| `expiresAt` | tương lai, tối đa 30 ngày từ lúc tạo theo cấu hình | SRS |
| `status` | `DRAFT`, `OPEN`, `NEGOTIATING`, `MATCHED`, `CLOSED`, `CANCELLED`, `EXPIRED` | SRS |

`preferredSlots` có thể dùng bảng con `LearningRequestPreferredSlot(requestId, startAt, endAt)` **[Đề xuất]** thay vì JSON. Chỉ `OPEN` nhận Proposal mới; User không được đề nghị vào Request của mình.

### 3.2. Proposal [SRS]

**Chức năng:** đề nghị hướng dẫn một Learning Request. Khi được chấp nhận, chỉ mở Conversation để thương lượng.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `proposalId` | UUID/ULID, khóa chính | Đề xuất |
| `learningRequestId` | FK → LearningRequest OPEN | SRS |
| `proposerId` | FK → User có Sharing Skill phù hợp | Đề xuất từ quan hệ SRS |
| `message` | string 10–1000 | SRS |
| `proposedDurationMinutes` | integer 30–240, bước 30 | SRS |
| `proposedCredit` | integer ≥ `MIN_SESSION_CREDIT` nếu nhập; chỉ gợi ý | SRS |
| `candidateSlots` | 0–5 khoảng thời gian tương lai; chỉ gợi ý | SRS |
| `initialSessionCount` | integer 1–20 hoặc theo cấu hình; chỉ gợi ý | SRS |
| `expiresAt` | theo cấu hình, mặc định 72 giờ hoặc trước slot gần nhất | SRS |
| `status` | `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED` | SRS |

Một proposer có tối đa một Proposal PENDING cho cùng Request. `ACCEPTED` **không** tạo Session, khóa lịch hay Hold Credit. `candidateSlots` có thể là bảng con **[Đề xuất]**.

### 3.3. Conversation [SRS]

**Chức năng:** kênh thương lượng riêng giữa hai User sau Proposal được chấp nhận.

Field: `conversationId` **[SRS]**; `learningRequestId`, `proposalId`, `participantAId`, `participantBId`, `createdAt` **[Đề xuất từ quan hệ SRS]**. Chỉ hai participant được đọc/gửi tin. Conversation gắn với Proposal/Request để truy vết thỏa thuận.

### 3.4. Message [SRS]

**Chức năng:** tin nhắn và sự kiện nghiệp vụ hiển thị trong Conversation.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `messageId` | UUID/ULID, khóa chính | Đề xuất |
| `conversationId` | FK → Conversation | SRS |
| `senderId` | FK → User hoặc SYSTEM với message sự kiện | Đề xuất |
| `messageText` | string 1–2000 nếu không có attachment; sanitize | SRS |
| `attachment` | ảnh/PDF tối đa 10 MB nếu triển khai | SRS |
| `messageType` | `TEXT`, `FILE`, `SCHEDULE_PROPOSAL_CREATED`, `SCHEDULE_UPDATED`, `USER_CONFIRMED`, `SCHEDULE_LOCKED`… | SRS |
| `sentAt` | datetime UTC, immutable | SRS |
| `readAt` | datetime nullable | SRS |

Text chat thông thường không thay thế thao tác Confirm có cấu trúc trên đúng `scheduleProposalId + version`.

## 4. Lịch chung và buổi học

### 4.1. ScheduleProposal [SRS]

**Chức năng:** phiên bản đề xuất lịch chính thức trong Chat, gồm một hay nhiều buổi, giờ và Credit từng buổi.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `scheduleProposalId` | UUID/ULID, unique | SRS |
| `proposalId` | FK → Proposal ACCEPTED | SRS |
| `conversationId` | FK → Conversation | Đề xuất từ rule SRS |
| `participantAId`, `participantBId` | FK → hai User khác nhau | SRS |
| `version` | integer, bắt đầu 1; tăng khi đổi số buổi/giờ/Credit | SRS |
| `status` | `DRAFT`, `PROPOSED`, `PARTIALLY_CONFIRMED`, `LOCKED`, `NEEDS_REVISION`, `CANCELLED`, `EXPIRED` | SRS |
| `participantAConfirmed`, `participantBConfirmed` | boolean, mặc định false; reset khi version tăng | SRS |
| `totalHeldCreditPerUser` | tổng `sessionCredit` của các ScheduleItem | SRS |
| `participantAConfirmedAt`, `participantBConfirmedAt` | thời điểm xác nhận | Đề xuất từ yêu cầu lưu `confirmedAt` SRS |
| `participantAConfirmedVersion`, `participantBConfirmedVersion` | version đã xác nhận | Đề xuất từ yêu cầu lưu version SRS |

Một bên Confirm → `PARTIALLY_CONFIRMED`, chưa Hold. Khi cả hai Confirm cùng version, backend kiểm tra **toàn bộ** lịch của cả hai, trạng thái Request/Proposal và số dư của cả hai. Thành công mới Hold Credit hai bên, `LOCKED` và tạo Session một cách nguyên tử; thất bại phải rollback/release. Sau `LOCKED`, đổi giờ cần proposal đổi lịch mới và hai bên Confirm lại.

### 4.2. ScheduleItem [SRS]

**Chức năng:** một buổi dự kiến trong ScheduleProposal; sau LOCKED ánh xạ thành Session.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `scheduleItemId` | UUID/ULID, khóa chính | Đề xuất |
| `scheduleProposalId` | FK → ScheduleProposal | Đề xuất từ quan hệ SRS |
| `sessionNo` | integer từ 1 đến N, unique trong một proposal | SRS |
| `startAt` | datetime tương lai khi khóa lịch, UTC | SRS |
| `endAt` | datetime > `startAt`, duration theo cấu hình | SRS |
| `sessionCredit` | integer ≥ `MIN_SESSION_CREDIT`; **mỗi User** Hold khoản này | SRS |

### 4.3. Session [SRS]

**Chức năng:** buổi học 1:1 thực tế từ ScheduleProposal đã LOCKED.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `sessionId` | UUID/ULID, khóa chính | Đề xuất |
| `scheduleProposalId`, `scheduleItemId` | nguồn lịch đã khóa | SRS nêu liên kết; tên cột đề xuất |
| `participantAId`, `participantBId` | đúng hai User tham gia | SRS |
| `skillId`/`context` | kỹ năng/bối cảnh buổi học | SRS nêu nội dung; cấu trúc đề xuất |
| `startAt`, `endAt` | giờ buổi học đã chốt, UTC | SRS |
| `roomId` | FK → LiveKitRoom nếu dùng bảng riêng | SRS nêu room id |
| `sessionCredit` | Credit cam kết **của mỗi participant** cho buổi này | SRS |
| `status` | `CONFIRMED`, `READY`, `ONGOING`, `AWAITING_CONFIRMATION`, `COMPLETED`, `CANCELLED`, `DISPUTED` | SRS |
| `cancelledBy`, `cancelledAt`, `cancelReason` | dữ liệu hủy để áp dụng policy | Đề xuất từ rule SRS |

Tạo room không chứng minh Session hoàn thành. Session bị dispute tiếp tục giữ Held Credit liên quan. Nếu Session hủy hoặc no-show, backend áp policy, ghi actor/thời gian/lý do và ledger đối ứng.

### 4.4. SessionConfirmation [Đề xuất từ rule SRS]

**Chức năng:** xác nhận kết thúc buổi học riêng của từng User.

Field đề xuất: `sessionId`, `userId`, `status`, `confirmedAt`, `note`. Khóa unique `(sessionId, userId)`. Hai xác nhận hợp lệ và không có dispute → Session `COMPLETED`; timeout khi một bên im lặng chỉ dùng nếu Product Owner bật cấu hình. Có thể đặt dữ liệu này trong Session thay vì bảng riêng, nhưng vẫn phải thể hiện hai trạng thái độc lập.

### 4.5. LiveKitRoom [SRS]

**Chức năng:** ánh xạ Session tới phòng video/audio 1:1.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `roomId` | ID nội bộ/LiveKit | SRS nêu room id |
| `sessionId` | FK → Session | SRS |
| `roomName` | backend sinh từ Session hoặc mapping an toàn | SRS |
| `metadata` | dữ liệu tích hợp cần thiết | SRS |

`participantIdentity` map `userId + sessionId`; `accessToken` được backend sinh ngắn hạn cho đúng participant trong join window, không lưu/log nguyên token. Chỉ Session hợp lệ ở trạng thái cho phép mới được cấp token.

### 4.6. SessionAttendance [Đề xuất, tùy tích hợp]

**Chức năng:** lưu thời điểm tham gia/rời phòng từ LiveKit webhook nếu khả dụng và phù hợp chính sách riêng tư.

Field đề xuất: `sessionId`, `userId`, `joinedAt`, `leftAt`, `providerEventId`. Attendance không tự thay thế xác nhận hoàn thành.

### 4.7. HeldCreditAllocation [Đề xuất từ rule SRS]

**Chức năng:** phân bổ Held Credit **theo từng User và Session**; tránh dùng phần Hold của Session khác khi release/settlement/dispute.

Field đề xuất: `allocationId`, `userId`, `sessionId`, `scheduleProposalId`, `amount`, `remainingHeld`, `status`, `createdAt`, `settledAt`. Cần một ràng buộc/ledger để tổng Held allocation của User khớp `CreditWallet.heldCredit`.

## 5. Ví Credit và thanh toán

### 5.1. CreditWallet [SRS]

**Chức năng:** số dư Credit của từng User; mọi thay đổi phải có CreditTransaction.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `userId` | FK → User, một ví cho một User | Đề xuất |
| `availableCredit` | integer ≥0, được dùng để cam kết lịch | SRS |
| `heldCredit` | integer ≥0, Credit đã khóa của chính User | SRS |
| `purchasedCredit` | integer ≥0, theo dõi nguồn nạp nếu cần | SRS |
| `bonusCredit` | integer ≥0, Credit thưởng | SRS |
| `walletVersion` | integer, optimistic locking/chống double spend | SRS |

SRS chưa chốt bucket `earnedCredit` dù phần Withdrawal có nhắc tới. Không tự coi Credit được hoàn 96% là thu nhập từ người dạy.

### 5.2. CreditTransaction [SRS]

**Chức năng:** ledger bất biến cho mọi biến động Credit; dùng đối soát và chống xử lý trùng.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `transactionId` | UUID, unique | SRS |
| `userId` | FK → User có ví bị ảnh hưởng | SRS |
| `type` | `TOP_UP`, `DAILY_BONUS`, `FEEDBACK_BONUS`, `HOLD`, `RELEASE`, `SESSION_RETURN`, `PLATFORM_FEE`, `WITHDRAWAL`, `REFUND`, `PENALTY`, `ADJUSTMENT`; SRS cũng nhắc `SESSION_EARNING` cho quyết định dispute đặc biệt | SRS |
| `amount` | integer, quy ước dấu/debit-credit phải thống nhất | SRS |
| `balanceAfter` | integer, nên có để đối soát | SRS |
| `referenceType` | `PAYMENT`, `SCHEDULE_PROPOSAL`, `SESSION`, `REVIEW`, `DISPUTE`, `SYSTEM` | SRS |
| `referenceId` | UUID/string ID nghiệp vụ liên quan | SRS |
| `status` | `PENDING`, `SUCCESS`, `FAILED`, `REVERSED` | SRS |
| `idempotencyKey` | bắt buộc ở luồng webhook/payment/settlement có retry | SRS |
| `createdAt` | datetime UTC, immutable | SRS |

Không sửa/xóa transaction cũ để điều chỉnh số dư. Với mỗi User/Session, settlement chỉ chạy một lần theo `sessionId + userId`: lấy `sessionCredit` khỏi Held, hoàn 96% vào Available **của chính User**, 4% là Platform Fee. Quy tắc làm tròn Credit nguyên cần chốt cấu hình.

### 5.3. Payment [SRS]

**Chức năng:** đơn nạp Credit, trạng thái gateway và dữ liệu đối soát.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `paymentId` | UUID nội bộ, unique | SRS |
| `userId` | người nạp | Đề xuất từ quan hệ SRS |
| `creditAmount` | integer >0, theo gói/ngưỡng cấu hình | SRS |
| `paymentAmount` | integer VND do backend tính | SRS |
| `currency` | `VND` cho bản Việt Nam nếu không có yêu cầu khác | SRS |
| `gateway` | cổng thanh toán hỗ trợ | SRS |
| `gatewayTransactionId` | unique theo gateway khi có callback | SRS |
| `externalRef`/`orderId` | mã tham chiếu đơn hàng duy nhất | SRS nêu, tên cột đề xuất |
| `status` | `CREATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED` | SRS |

Chỉ xác minh callback/webhook hoặc API verify hợp lệ mới chuyển PAID và sinh `TOP_UP` một lần. Client redirect thành công không đủ căn cứ cộng Credit. Không lưu CVV/dữ liệu thẻ nhạy cảm.

### 5.4. Withdrawal [SRS, tính năng tùy bật]

**Chức năng:** yêu cầu rút Credit nếu sản phẩm bật tính năng và chốt policy nguồn Credit/KYC/payout.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `withdrawalId` | UUID/ULID | Đề xuất |
| `userId` | FK → User | Đề xuất |
| `amountCredit` | integer ≥ `MIN_WITHDRAW_CREDIT`, không dùng Held/bonus | SRS |
| `bankName` | ngân hàng hoặc string 2–120 | SRS |
| `bankAccountNumber` | string 6–30, cần bảo vệ/mã hóa | SRS |
| `accountHolderName` | string 2–100 | SRS |
| `status` | `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `PROCESSING`, `PAID`, `REJECTED`, `CANCELLED` | SRS |

Khi tạo yêu cầu hợp lệ phải reserve Credit để tránh chi tiêu kép; reject/cancel hợp lệ phải release. SRS chưa chốt nguồn Credit nào được rút; quy tắc chỉ `earnedCredit` mới rút hiện là **đề xuất**, chưa phải mặc định production.

## 6. Đánh giá, uy tín và tranh chấp

### 6.1. Review [SRS]

**Chức năng:** đánh giá participant còn lại sau Session đủ điều kiện.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `reviewId` | UUID/ULID | Đề xuất |
| `sessionId` | FK → Session COMPLETED | SRS |
| `reviewerId` | participant gửi Review | SRS nêu vai trò; tên cột đề xuất |
| `revieweeId` | participant còn lại | SRS |
| `rating` | integer 1–5 | SRS |
| `comment` | string 0–1000, sanitize; đề xuất yêu cầu ≥20 ký tự khi rating ≤2 | SRS |
| `createdAt` | datetime UTC | SRS |

Unique `(sessionId, reviewerId, revieweeId)` hoặc ràng buộc tương đương: một User chỉ review đối phương tối đa một lần/Session. Review vi phạm có thể bị ẩn nhưng không xóa ledger/audit liên quan. Thưởng Feedback, nếu bật, phải có `FEEDBACK_BONUS` một lần/User/Session.

### 6.2. ReputationHistory [SRS]

**Chức năng:** lịch sử thay đổi điểm uy tín để giải thích, audit hoặc tính lại.

Field đề xuất theo mục 9.2 SRS: `historyId`, `userId`, `scoreBefore`, `scoreAfter`, `reason`, `sourceType`, `sourceId`, `createdAt`. Điểm Reputation nằm trong 0–100, backend tính từ rating, Session hoàn thành, cancel/no-show, dispute đã xác nhận và tín hiệu được duyệt. Công thức/trọng số chưa chốt production.

### 6.3. Report / Dispute [SRS]

**Chức năng:** tiếp nhận báo cáo vi phạm hoặc tranh chấp và lưu quyết định xử lý. Có thể là một bảng case với loại case, hoặc hai bảng Report/Dispute liên kết; SRS chưa quyết định.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `caseId` | UUID/ULID, khóa chính | Đề xuất |
| `reporterId` | User mở case | SRS nêu reporter; tên cột đề xuất |
| `targetType` | `USER`, `SESSION`, `REVIEW`, `MESSAGE`, `LEARNING_REQUEST`, `TRANSACTION` | SRS |
| `targetId` | ID mục tiêu tồn tại | SRS |
| `reasonCode` | `HARASSMENT`, `FRAUD`, `NO_SHOW`, `PAYMENT_CREDIT`, `INAPPROPRIATE_CONTENT`, `OTHER`… | SRS |
| `description` | string 20–2000 | SRS |
| `evidenceFiles` | tối đa 5 ảnh/PDF, 10 MB/file; nên tách bảng file nếu cần | SRS |
| `status` | `OPEN`, `UNDER_REVIEW`, `NEED_MORE_INFO`, `RESOLVED`, `REJECTED`, `CLOSED` | SRS |
| `handlerId` | Staff/Admin xử lý | SRS nêu handler; tên cột đề xuất |
| `resolutionCode`, `resolutionNote`, `resolvedBy`, `resolvedAt` | bắt buộc lưu khi có quyết định | SRS |

User chỉ dispute Session/Transaction liên quan trực tiếp tới mình. Held Credit của Session tranh chấp tiếp tục bị giữ. Mọi Release/Refund/Penalty/Adjustment sinh transaction mới và AuditLog; quyết định chuyển Credit giữa hai User là xử lý dispute đặc biệt, không phải settlement mặc định.

## 7. Thông báo, audit và cấu hình

### 7.1. Notification [SRS]

**Chức năng:** thông báo các sự kiện đăng ký, Proposal, lịch, Session, Credit, Review và Dispute.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `notificationId` | UUID/ULID | Đề xuất |
| `userId` | người nhận | SRS |
| `type` | `REGISTER_OTP`, `PROPOSAL_RECEIVED`, `PROPOSAL_ACCEPTED`, `SESSION_REMINDER`, `SESSION_CHANGED`, `CREDIT_CHANGED`, `REVIEW_RECEIVED`, `DISPUTE_UPDATED`… | SRS |
| `title`, `body` | nội dung không chứa secret/token nhạy cảm | SRS |
| `payload` | dữ liệu điều hướng/hiển thị | SRS mục 9.2 |
| `readAt` | nullable; chỉ người nhận được cập nhật | SRS |
| `channel` | `IN_APP`, `EMAIL`; Push nếu triển khai sau | SRS |
| `createdAt` | datetime UTC | Đề xuất |

### 7.2. AuditLog [SRS]

**Chức năng:** lịch sử bất biến “ai làm gì với đối tượng nào, khi nào” cho hành động nhạy cảm.

| Field | Kiểu / quy tắc | Nguồn |
|---|---|---|
| `auditId` | UUID, immutable | SRS |
| `actorId`, `actorRole` | User/Staff/Admin hoặc SYSTEM | SRS |
| `action` | ví dụ `LOGIN_SUCCESS`, `VERIFY_SKILL_APPROVE`, `LOCK_USER`, `CREDIT_ADJUST`, `DISPUTE_RESOLVE`, `ROLE_CHANGE` | SRS |
| `targetType`, `targetId` | đối tượng chịu tác động | SRS |
| `before`, `after` | dữ liệu cần audit; không chứa password/token/OTP/CVV | SRS |
| `reason` | bắt buộc với thao tác quản trị nhạy cảm | SRS |
| `ip`, `userAgent` | lưu theo chính sách bảo mật/riêng tư | SRS |
| `createdAt` | datetime UTC, immutable | SRS |

### 7.3. SystemConfiguration [Đề xuất từ SRS]

**Chức năng:** lưu ngưỡng/chính sách thay đổi được mà không sửa code.

Field đề xuất: `key`, `value`, `valueType`, `effectiveAt`, `updatedBy`, `updatedAt`, `version`. Các key được SRS nêu: `MIN_SESSION_CREDIT`, mức thưởng Daily Login/Feedback, giới hạn chống abuse, chính sách làm tròn 96%/4%, `FREE_CANCEL_BEFORE_HOURS`, `LATE_CANCEL_PENALTY_RATE`, `NO_SHOW_PENALTY_RATE`, `DISPUTE_WINDOW_HOURS`, timeout xác nhận, LiveKit join window, công thức Reputation, giới hạn Withdrawal. Giá trị production của nhiều key còn phải được Product Owner chốt.

## 8. Field chỉ thuộc form/API, không phải entity độc lập

| Luồng | Field đầu vào | Cách xử lý |
|---|---|---|
| Đăng ký | `fullName`, `email`, `password`, `confirmPassword`, `agreeTerms`, `timezone`, `locale` | `confirmPassword` chỉ để kiểm tra; `agreeTerms=true` tạo `termsVersion/termsAcceptedAt`; password chỉ biến thành `passwordHash`. |
| Xác minh email | `email`, `otpCode`, `purpose` | Kiểm tra với OtpChallenge; không lưu OTP rõ. |
| Đăng nhập | `email`, `password`, `rememberMe` | `rememberMe` chỉ ảnh hưởng TTL refresh session theo cấu hình. |
| Quên mật khẩu | `email`, `otp/token`, `newPassword`, `confirmNewPassword` | Token dùng một lần; không lưu `confirmNewPassword`. |
| Gửi xác minh Skill | `sharingSkillId`, `files`, `evidenceTitle`, `evidenceDescription` | Tạo SkillVerification và 1–5 SkillEvidence. |
| Cấp LiveKit | `participantIdentity`, `accessToken`, `joinWindow` | Identity/token được backend sinh theo User/Session; token là secret ngắn hạn, không nên là cột lâu dài. |

## 9. Quan hệ và ràng buộc cốt lõi

1. `User 1–1 Profile`, `User N–N Role`, `Role N–N Permission`.
2. `User 1–N SharingSkill`; `SharingSkill N–1 Skill`; `SharingSkill 1–N SkillVerification`; mỗi verification có 1–5 SkillEvidence.
3. `User 1–N LearningRequest`; `LearningRequest N–1 Skill`; `LearningRequest 1–N Proposal`; User không gửi Proposal vào Request của chính mình.
4. `Proposal ACCEPTED → Conversation → ScheduleProposal → ScheduleItem`; `ScheduleProposal LOCKED → Session`. Không được rút ngắn chuỗi này thành `Proposal ACCEPTED → Session`.
5. Mỗi ScheduleProposal/Session có đúng hai participant. Cả hai phải Confirm **cùng scheduleProposalId và version**; sửa nội dung phải tăng version và reset Confirm.
6. `User 1–1 CreditWallet`; `User 1–N CreditTransaction`; mỗi phần Held cần truy được tới **User + Session**. Hold cả hai ví và tạo lịch phải nhất quán/nguyên tử.
7. Settlement theo **từng Session và từng User**: hoàn 96% Held cho chính User, 4% Platform Fee; idempotent theo `sessionId + userId`. Không phát sinh thanh toán một chiều từ người học sang người dạy trong luồng chuẩn.
8. `Session 1–N Review` nhưng tối đa một Review từ mỗi participant cho participant còn lại. `Session 1–1 LiveKitRoom` theo mô hình thông thường; chỉ participant của Session hợp lệ được cấp token.
9. `Report/Dispute` có thể trỏ tới nhiều loại target; mọi quyết định liên quan Credit phải sinh ledger đối ứng và AuditLog.
10. Sau toàn bộ lộ trình đủ điều kiện, mới cập nhật “kỹ năng đã học”. Trạng thái này khác `SharingSkill.verificationStatus=VERIFIED`.

## 10. Những điểm SRS chưa chốt ở mức database

- Tên bảng/cột vật lý, chuẩn đặt tên, các index và lựa chọn JSON hay bảng con cho slots/files/payload.
- Cấu trúc RolePermission, OtpChallenge, OAuthAccount, RefreshSession, SessionConfirmation, HeldCreditAllocation, UserLearnedSkill và SystemConfiguration. Đây là các entity/bảng **đề xuất**, không phải tên bắt buộc từ SRS.
- Report và Dispute dùng một bảng case hay hai bảng; Schedule reschedule dùng version mới hay entity riêng.
- Có lưu các chỉ số Profile và `totalHeldCreditPerUser` dưới dạng cache hay tính lại từ bảng gốc.
- Chính sách Withdrawal, công thức Reputation, penalty hủy/no-show, timeout, các mức thưởng và quy tắc làm tròn 96%/4% trước production.
