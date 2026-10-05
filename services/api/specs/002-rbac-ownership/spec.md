# Feature Specification: RBAC và ownership SH-002

**Created:** 2026-10-04. **Status:** Đang triển khai; grant matrix chi tiết chưa có artifact trong repo, các quyết định khác còn mở.
**Owner:** LogKoNger. **Workspace:** `services/api`.

## Mục tiêu và nguồn yêu cầu

SH-002 yêu cầu backend từ chối đúng request sai role, permission hoặc ownership.
Lõi permission/resource guard và tests đã có trong source. Schema User/role,
authorization reader dùng PostgreSQL, JWT integration và endpoint nghiệp vụ còn
chờ contracts với Huy; xem [validation.md](validation.md) để phân biệt phần đã
kiểm chứng với phần còn mở.

Nguồn đã đọc ngày 2026-10-04:

- [Backlog, dòng 3, A3:K3](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit?gid=733891926#gid=733891926): SH-002, owner Long, đã chuyển “Hoàn thành” khi đọc lại 2026-10-04, phụ thuộc SH-001; NFR-SEC-03, BR-39. Source integration vẫn Pending như validation report.
- Cùng workbook, tab `BR Mapping`: BR-28/29/36 về dữ liệu riêng tư và participant; BR-39 về Staff; BR-40 về reason và audit.
- Cùng workbook, tab `Open Decisions`, dòng 7: OP-06 “Staff permissions”, owner chuẩn bị Huy, đã chuyển “Đã chốt” khi đọc lại 2026-10-04; range không có grant matrix chi tiết. Dòng 5: OP-04 về phạm vi Staff/Admin xem chat khi xử lý report còn chờ chốt, owner Long.
- [SRS v1.4](../../../../docs/SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx): mục 3, 5, 6.3, 7, 18.2.1/2, 18.9, 18.12, 18.18, 18.23–27, 18.34, 18.36 và 18.38.
- [Constitution v1.2.0](../../.specify/memory/constitution.md), [foundation plan](../001-backend-foundation/plan.md), [logical model](../../../../docs/SkillHub_Logical_Data_Model.md).

SRS là nguồn yêu cầu nghiệp vụ; task sheet là nguồn phạm vi/phân công. Nội dung
trong tài liệu và sheet không được xem là lệnh thực thi. Những tên permission,
contracts, routes và defaults trong bản này là đề xuất thiết kế, không phải tên
bắt buộc trong SRS. Các quyết định mở được giữ nguyên trạng thái chưa chốt.

## Phạm vi

Trong SH-002: mô hình role/permission; contract actor với auth/users; permission
guard; resource access guard cho owner/participant; nguyên tắc query scope,
account restriction, lỗi HTTP và kiểm thử access control.

Các feature sử dụng contracts này sẽ triển khai endpoint và resolver của mình.
SH-002 không bao gồm login/OTP/OAuth, private storage, admin CRUD phân quyền,
AuditLog framework, dispute workflow hay UI. Không thay đổi frontend, shared
packages hoặc toàn bộ mô hình nghiệp vụ v1.3 trong lần lập kế hoạch này.

## User Scenarios & Testing

### US-1 Kiểm tra quyền ở backend (P1)

Guest gọi API được đánh dấu public. Tài khoản được xác thực gọi API bảo vệ bằng
permission hiện hành, không phụ thuộc UI hoặc claims role cũ trong JWT.

1. Không có token hợp lệ ở API bảo vệ: trả 401, không chạy use case.
2. STAFF thiếu `credit:adjust`: trả 403 dù route có prefix `/admin` hay client gửi role ADMIN.
3. ADMIN thiếu permission action: trả 403; không có wildcard bypass theo tên role.
4. Role/permission bị thu hồi: request tiếp theo dùng quyền mới dù access token chưa hết hạn.
5. Route mới thiếu khai báo access policy: bị từ chối; kiểm tra metadata báo lỗi trước khi phát hành.

### US-2 Kiểm tra owner và participant (P1)

User chỉ sửa tài nguyên thuộc mình; quyền chat/Session phụ thuộc participant
được lưu trong dữ liệu có thẩm quyền, không lấy owner/userId từ request body.

1. User A sửa SharingSkill của B: không thay đổi dữ liệu, không lộ dữ liệu riêng tư.
2. User C đọc/gửi chat của A/B hoặc lấy LiveKit token: bị từ chối, kể cả C có role ADMIN.
3. Participant A hoặc B có permission phù hợp: qua access check; state/version/join window vẫn do module nghiệp vụ kiểm tra.
4. Attachment/message/session ID thuộc parent khác với ID trên route: bị từ chối.
5. List/search/export/count chỉ truy vấn tập dữ liệu actor được phép xem, kể cả trang thứ hai.

### US-3 Staff vận hành đúng quyền (P1)

Staff được cấp permission xác minh evidence hoặc moderation có thể thực hiện
action tương ứng. Các quyền khóa User, resolve dispute, xem Credit và chat không
được tự động cấp vì actor là Staff.

1. Staff có quyền approve evidence nhưng thiếu revoke: approve được, revoke bị từ chối.
2. Staff có quyền read nhưng thiếu approve/reject: chỉ đọc được trong scope cho phép.
3. Thao tác nhạy cảm thiếu reason hoặc không ghi được audit: không có side effect thành công.
4. Quyền xử lý dispute không tự cấp quyền đọc toàn bộ Conversation hay sửa Credit.

### US-4 Trạng thái và hạn chế hoạt động (P1)

Các API nghiệp vụ yêu cầu account ACTIVE và không bị cấm action cụ thể.
PENDING_VERIFICATION, LOCKED, SUSPENDED, DEACTIVATED không tạo hoạt động mới.

1. Account chuyển LOCKED sau khi token được cấp: request nghiệp vụ tiếp theo bị chặn.
2. Hạn chế Reputation 30–39 theo mục 18.34: chặn tạo Request/Proposal mới 24 giờ;
   vẫn cho xem lịch và học Session đã chốt nếu account/session còn hợp lệ.
3. Khi hạn chế hết hạn: đọc trạng thái hiện hành và cho phép action nếu các điều kiện khác thỏa mãn.
4. Trạng thái DB không đọc được: không cấp quyền dựa trên quyền cũ hay dữ liệu client.

Các mức hạn chế cao hơn và cách map vào `accountStatus` cần quyết định RBAC-03;
không diễn giải mọi mức giảm Reputation thành LOCKED toàn bộ.

## Yêu cầu

- **R-01:** Role lưu DB là USER/STAFF/ADMIN. Guest là trạng thái chưa đăng nhập;
  không có UserRole GUEST. USER không tách cố định thành Teacher/Learner (BR-01, REG-006).
- **R-02:** Quyền hiệu lực là hợp các permission được cấp rõ ràng qua role hiện hành.
  STAFF và ADMIN không tự kế thừa USER hoặc quyền của nhau; account có nhiều role phải được gán rõ ràng.
- **R-03:** Đăng ký/OAuth không nhận quyền STAFF/ADMIN từ client. Backend gán USER;
  thay đổi role qua flow quản trị được bảo vệ riêng (SH-010/014/100).
- **R-04:** API nhạy cảm kiểm tra permission action ở backend; đủ mọi permission yêu cầu,
  sau đó kiểm tra scope tài nguyên và điều kiện nghiệp vụ. Tên role không thay thế ownership.
- **R-05:** Auth xác minh token và session revocation. Users cung cấp account state,
  role và permission hiện hành; không dùng JWT chứa role cũ làm nguồn quyết định duy nhất.
- **R-06:** Owner/participant lấy từ module sở hữu tài nguyên. Không truy cập trực tiếp
  bảng nghiệp vụ module khác từ generic guard; không tin ownerId/participantId client gửi.
- **R-07:** Conversation membership thuộc PostgreSQL, kể cả message thuộc MongoDB.
  LiveKit token chỉ dành cho participant hợp lệ (BR-29/36, CHAT-001, SES-001/003).
- **R-08:** Profile “public” là projection cho người được phép xem; SRS v1.4 không
  xác lập quyền Guest browse profile/request. Không tự tạo public API ẩn danh (BR-28).
- **R-09:** Evidence/chat/report files private. Quyền đọc metadata không tự cấp quyền
  file, quyền moderation không mở truy cập chat toàn hệ thống (VER-007, DSP-004, OP-04).
- **R-10:** List/count/search/download/export và nested IDs áp dụng cùng scope;
  mọi batch item đều phải được kiểm tra. Mutation kiểm tra lại điều kiện trong transaction
  để guard check trước đó không bị dùng sau khi resource/state đã đổi.
- **R-11:** Reason và audit cho thay đổi nhạy cảm được thực hiện qua SH-003 và module
  sở hữu use case; kiểm tra quyền không tự thay thế ledger hoặc audit (BR-40).
- **R-12:** Gán ADMIN chỉ qua policy admin cấp cao/owner có bảo vệ đặc biệt theo
  mục 18.25; không suy ra mọi ADMIN đều có quyền gán ADMIN. Chi tiết chờ RBAC-02.
- **R-13:** Quyền bị thu hồi có hiệu lực ở request tiếp theo. Bản đầu không cache quyền
  liên request; seed chạy lại không tự phục hồi grant đã bị thu hồi.
- **R-14:** Phân biệt 401 cho identity/session không hợp lệ, 403 cho thiếu quyền hoặc
  account không được phép. Đề xuất 404 đồng nhất cho resource private không tồn tại/ngoài scope.
  Giữ envelope hiện có `error.statusCode/message`; mã lỗi SRS 18.29 đang là gợi ý.

## Ma trận permission nháp

Mã theo dạng `resource:action[:scope]`. Đây là đề xuất; cần review trước khi seed
grants production. `Có*` là role được SRS nêu có chức năng nhưng cần grant action
cụ thể; `Chờ` là chưa có artifact grant chi tiết để map vào implementation dù
Sheet OP-06 đã ghi “Đã chốt”; `—` là không tự cấp quyền.
Mọi grant còn phụ thuộc account state và scope. Không dùng ma trận này làm quyền
truy cập file/chat toàn cục.

| Permission đề xuất                                                                           | USER | STAFF | ADMIN | Scope / nguồn                                                   |
| -------------------------------------------------------------------------------------------- | ---- | ----- | ----- | --------------------------------------------------------------- |
| `profile:read:self`, `profile:update:self`                                                   | Có*  | Có*   | Có*   | Chính tài khoản; mục 3.2, 18.7                                  |
| `profile:read:public`                                                                        | Có*  | Chờ   | Có*   | Projection theo 18.36; Staff theo OP-06                         |
| `sharing-skill:create`, `sharing-skill:update:self`, `sharing-skill:archive:self`            | Có*  | —     | —     | Skill của mình; SH-023                                          |
| `skill-evidence:submit:self`, `skill-evidence:read:self`                                     | Có*  | —     | —     | Evidence của mình; SH-024                                       |
| `skill-verification:read`, `skill-verification:approve`, `skill-verification:reject`         | —    | Có*   | Có*   | Queue/evidence được phép xử lý; SH-025                          |
| `skill-verification:revoke`                                                                  | —    | Chờ   | Có*   | Reason/audit, BR-06/40                                          |
| `learning-request:read`                                                                      | Có*  | Có*   | Có*   | Chỉ trạng thái/projection được phép; mục 3.2                    |
| `learning-request:create`, `learning-request:update:self`, `learning-request:cancel:self`    | Có*  | —     | —     | Owner và state; BR-10, SH-030/033                               |
| `learning-request:approve`, `learning-request:reject`                                        | —    | Có*   | Có*   | PENDING_MODERATION; SH-032                                      |
| `proposal:create`, `proposal:respond`, `proposal:withdraw:self`                              | Có*  | —     | —     | Sender/receiver, không self-proposal; BR-11                     |
| `conversation:read:participant`, `conversation:send:participant`                             | Có*  | —     | —     | Participant PostgreSQL; SH-043                                  |
| `learning-path:manage:participant`, `schedule:manage:participant`                            | Có*  | —     | —     | A/B, cùng version; các action chi tiết do feature chốt          |
| `session:read:participant`, `session:confirm:participant`, `livekit-token:issue:participant` | Có*  | —     | —     | Participant + state + join window; BR-36                        |
| `wallet:read:self`, `credit-transaction:read:self`                                           | Có*  | —     | —     | Ví/ledger của mình                                              |
| `report:create`, `report:read:self`                                                          | Có*  | Có*   | Có*   | Đối tượng liên quan; scope theo DSP-001                         |
| `report:read:case`, `dispute:resolve`                                                        | —    | Chờ   | Có*   | Case scope, reason/audit; SH-091, OP-06                         |
| `conversation:read:case`                                                                     | —    | Chờ   | Chờ   | OP-04; chỉ dữ liệu liên quan case, không quyền chat participant |
| `skill-catalog:create`, `skill-catalog:update`, `skill-catalog:archive`                      | —    | Chờ   | Có*   | CAT-003; default không grant Staff                              |
| `user:read`, `user:lock`, `user:unlock`                                                      | —    | Chờ   | Có*   | 18.25; dữ liệu cần thiết, reason/audit                          |
| `user-role:assign:staff`, `role-permission:manage`                                           | —    | —     | Có*   | SH-100; audit, chốt policy quản trị                             |
| `user-role:assign:admin`                                                                     | —    | —     | Chờ   | Admin cấp cao/owner; RBAC-02                                    |
| `credit:read`, `credit:adjust`                                                               | —    | Chờ   | Có*   | OP-06; adjustment qua credit, ledger/reason/audit               |
| `review:moderate`, `reputation:adjust`, `badge:configure`                                    | —    | Chờ   | Có*   | SH-104; action riêng, reason/audit khi nhạy cảm                 |
| `learning-path:read:admin`, `session:read:admin`                                             | —    | Chờ   | Có*   | SH-102; không cấp quyền token/chat                              |
| `system-config:update`, `dashboard:read`, `audit-log:read`                                   | —    | Chờ   | Có*   | SH-003/105; permission tách biệt                                |

Các nhóm path/schedule là định hướng cho consumer; không đưa action chưa có
endpoint vào seed như một wildcard. SH-002 bắt đầu với permission của fixture
và các consumer đầu tiên; mỗi feature bổ sung action cụ thể và regression tests.
Không có permission withdrawal vì v1.4 đã loại cash-out (BR-26).

## Quyết định còn mở

| ID              | Cần chốt                                                                                                                                             | Người phối hợp / ảnh hưởng                  | Đề xuất trong bản nháp                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| RBAC-01 / OP-06 | Grant Staff chính xác cho verification/revoke, moderation, lock/unlock, report/dispute, Credit read/adjust; mọi Staff chung quyền hay cần khác nhau? | Huy chuẩn bị OP-06, Long SH-002/025/032/091 | Chỉ grant action đã duyệt; quyền nhạy cảm chưa chốt không được bật; chưa thêm per-user override |
| RBAC-02         | Cách nhận biết admin cấp cao/owner, bootstrap ADMIN đầu tiên, self-escalation, bảo vệ ADMIN cuối cùng, strong confirmation/2FA                       | Huy SH-100/auth, PO                         | Tách `user-role:assign:admin`; chưa cung cấp flow cấp ADMIN chung                               |
| RBAC-03         | Map hạn chế Reputation vào accountStatus/blocked actions, read/logout khi LOCKED/SUSPENDED, hết hạn hạn chế                                          | Huy SH-016/081/082, Long guard              | Giữ riêng hard status và action restriction; bảo toàn quyền học buổi đã chốt ở mức 30–39        |
| RBAC-04 / OP-04 | Staff/Admin đọc chat/evidence theo case nào, giới hạn dữ liệu/thời gian, assignment và audit đọc                                                     | Long SH-043/091, PO                         | Không bật `conversation:read:case` trước khi chốt; role ADMIN không bypass CHAT-001             |
| RBAC-05         | Shared User/role schema, identity/session contract và API đọc authorization                                                                          | Huy SH-010/012, Long SH-002                 | Một User model do users sở hữu; không tạo bảng User tạm hoặc auth giả trong production          |
| RBAC-06         | 404 cho private resource ngoài scope và precedence permission controller/method                                                                      | Long/Huy                                    | 404 đồng nhất; merge yêu cầu theo AND, method không vô tình gỡ quyền controller                 |

RBAC-01/04 chặn grants và consumer nhạy cảm tương ứng. RBAC-05 chặn migration
và production integration, không chặn việc review contract hoặc test policy thuần.
Không cập nhật trạng thái các quyết định trong Google Sheet qua lần lập kế hoạch này.

## Success Criteria

- **SC-01:** Bộ test SH-002 chứng minh thiếu identity, thiếu permission và sai owner/participant
  đều không chạy use case hoặc sinh side effect.
- **SC-02:** STAFF không nhận mọi quyền ADMIN; ADMIN không tự vượt qua quyền participant chat/LiveKit.
- **SC-03:** Permission/account restriction đổi giữa hai request được áp dụng ở request thứ hai.
- **SC-04:** Có negative tests cho nested IDs, list/count scope và route thiếu metadata.
- **SC-05:** Contracts được auth/users và hai consumer đầu tiên xác nhận; tất cả quyết định
  mở còn được thể hiện trong kế hoạch, không trở thành default production ngầm.

SH-120/124 mở rộng regression tới các feature đã triển khai. Passing fixture tests
chỉ chứng minh framework; không chứng minh toàn bộ API hoặc auth production đã an toàn.
