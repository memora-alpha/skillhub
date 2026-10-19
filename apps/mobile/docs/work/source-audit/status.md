# Kết quả rà source mobile

## Hiện trạng

- Cập nhật lúc: 2026-10-19T20:31:39+07:00.
- Trạng thái: Done cho phạm vi review source/checks; chưa sửa hai findings bên dưới.
- Nguồn yêu cầu: người dùng “rà lại đi”, sau khi xác nhận Wallet/Payment đang làm ở nhánh khác.
- Baseline: docs/mobile-workflow tại ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd, source working tree không có diff trước review.
- Kết luận: xác nhận hai findings P2. Chưa phát hiện thêm lỗi có đủ bằng chứng để báo trong các phần đã rà; điều này không xác nhận toàn app/API/native hoàn chỉnh.
- Nghiệm thu người dùng: Không yêu cầu cho báo cáo review; chưa có xác nhận chấp nhận sản phẩm hoặc quyền sửa source.
- Bước tiếp theo đề xuất: sửa từng finding với regression theo trigger bên dưới khi được giao; giữ runtime/contract hiện tại và kiểm consumers liên quan.

## F01 — P2 — Dữ liệu Skills riêng tư vẫn hiển thị sau khi server từ chối đọc

**Trigger:** đã tải own skill/history thành công; sau đó tài khoản vẫn ACTIVE nhưng bị restriction ALL, backend trả403 SKILL_PERMISSION_REQUIRED. Đây là ca backend có thật theo [SkillActorService](../../../../../services/api/src/modules/users/application/services/skill-actor.service.ts), không phải giả định đổi account hoặc mất mạng.

**Source:** [useOwnSkill](../../../src/features/skills/hooks/use-skill-queries.ts), dòng169–176, để error từ api.findOwn đi thẳng vào Query; TanStack giữ data cũ sau refetch lỗi. [SkillDetailScreen](../../../src/features/skills/screens/SkillDetailScreen.tsx), dòng25–37, chỉ chặn null/archived/không data nên tiếp tục mount header/history/actions khi data cũ còn. [VerificationDetailScreen](../../../src/features/skills/screens/VerificationDetailScreen.tsx) và history cũng render cached batch/reasons dù có lỗi đọc.

**Tác động:** nội dung own/private và lịch sử xác minh vẫn hiện sau authoritative read denial; nút quản lý không bị khóa theo quyền đọc. Một503 sau denial vẫn giữ snapshot đó. Không khẳng định server cho phép mutation/download trái quyền: server vẫn kiểm quyền, lỗi nằm ở UI/cache giữ dữ liệu đã bị từ chối đọc.

**Bằng chứng:** harness thực thi useOwnSkill thật, createSkillsApi/shared HTTP với Axios fixture và QueryClient/QueryObserver thật:200 →403 →503 vẫn giữ own DTO. Thực thi SkillDetailScreen thật qua JSX tree cho thấy VerificationHistory vẫn mounted với headerProps.skill cũ và pending=false sau403. Không chỉ đọc source string để khẳng định bug.

**Đề xuất sửa:** phân biệt GET403/404 với transient errors; che/loại owner/history/detail snapshot và khóa actions sau read denial, chỉ mở lại khi read thành công đúng resource/session. Không hồi sinh dữ liệu khi retry503. Không áp read-denial policy lên mutation403 hoặc mọi lỗi mạng. Dùng LR RequestReadGuard làm tham khảo về semantics, không thêm private cross-feature import.

**Regression cần:**200→403→503→200 cho owner detail/history/verification; denial không mount private files/actions, lỗi transient đơn thuần vẫn giữ last-read khi policy cho phép, session switch không hồi dữ liệu cũ.

## F02 — P2 — Reset token sống qua thời điểm phiên signed-in kết thúc

**Trigger:** user signed-in đã verify recovery OTP, đang ở /reset-password với proof memory-only; session hết hạn/bị revoke khiến generation đổi và session thành guest trong khi vẫn ở route recovery.

**Source:** [AuthNavigator](../../../src/features/auth/components/AuthNavigator.tsx), dòng12–22, effect chạy lại theo generation nhưng chỉ clear khi rời recovery route hoặc có email mới khác draft. Khi guest, email undefined nên không clear. [Recovery store](../../../src/features/auth/utils/password-recovery-flow.ts) không gắn proof với generation. [ResetPasswordScreen](../../../src/features/auth/screens/ResetPasswordScreen.tsx), dòng46–64, tiếp tục nhận proof còn trong store nếu chưa hết hạn.

**Tác động:** credential khôi phục từ phiên trước còn ở màn reset và bộ nhớ sau khi phiên kết thúc; nếu server grant vẫn hợp lệ, người tiếp tục dùng thiết bị có thể đi tiếp reset mà không verify lại. Đây là thiếu cleanup local, không phải bằng chứng đã thực hiện đổi mật khẩu trái phép hoặc backend grant luôn còn hợp lệ sau mọi loại revoke.

**Bằng chứng:** thực thi effect thật của AuthNavigator với recovery store thật: authenticated generation1/emailA → guest generation2, cùng /reset-password; proof vẫn nguyên sau effect mới. Proof dùng chuỗi giả, không account/OTP/token thật và không gọi API.

**Đề xuất sửa:** gắn lifecycle draft/proof với session/generation khi bắt đầu recovery từ signed-in; clear khi session đó kết thúc/đổi. Giữ guest recovery hợp lệ và không xóa proof nhầm sau OTP verify hoặc guest→signed-in transition đã có policy rõ. Bổ sung regression cho expiry/logout/account switch cùng email/khác email.

## Checks đã thực hiện

Từ apps/mobile, dùng binary đã cài tại root node_modules; không install:

| Command thực chạy                                                                        | Kết quả                                | Giới hạn                                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| node ../../node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts test/profile.test.mjs | PASS296/296,0 failed/skipped/cancelled | Node/fixture/helper/hook harness, không native UI      |
| node ../../node_modules/typescript/bin/tsc --noEmit                                      | PASS                                   | Static types                                           |
| node scripts/check-structure.mjs                                                         | PASS460 source files                   | Checker không audit đầy đủ graph/semantics             |
| node ../../node_modules/eslint/bin/eslint.js . --max-warnings 0                          | PASS                                   | ESLint hiện có, không chứng minh privacy/lifecycle đủ  |
| Reproduction source/VM/QueryClient                                                       | PASS2 assertions tái hiện bug          | Dependency injection, không React Native device render |

Các lệnh trên tương đương nội dung scripts package đã đọc; không gọi pnpm install hoặc thay dependencies. Tất cả findings vẫn có thể tồn tại khi296 tests hiện tại xanh vì suite chưa bao phủ các trigger này.

### Chạy lại reproduction

Từ apps/mobile trong PowerShell:

    Get-Content docs/work/source-audit/evidence/reproduce.cjs.txt -Raw | node --import tsx

[Source reproduction](evidence/reproduce.cjs.txt) dùng source thật được transpile trong VM, mock lifecycle/native shell và existing Axios fixtures. Nó chỉ thay in-process memory, không đọc .env, không persistence hoặc request ra ngoài. Kết quả F01/F02 CONFIRMED nghĩa là bug đã tái hiện, không nghĩa đã sửa.

## Phạm vi và giới hạn

Đã rà Auth controller/storage/HTTP/recovery/gates; network connection store/probe/recovery; LR requests API/query/preflight/recovery/form/navigation/weekly/Tag/offerings; Profile public/own/avatar; Skills parsers/query/cache/save/verification/evidence transfer/scan/compression logic liên quan. Backend chỉ đọc contract/controller/DTO/service phục vụ đối chiếu, không sửa.

Real API/mailbox/storage/scanner/Staff approval, Android/iOS/native keyboard/Back/picker/EXIF/background/process kill, full visual/accessibility review: NOT_RUN. Không dùng kết quả review thay các acceptance T025..T032 hoặc AC của specs003/004. Wallet/Payment và nhánh triển khai nó ngoài phạm vi. Không thêm kết luận Sonar Quality Gate từ local tests.

## Nhật ký 2026-10-19T20:31:39+07:00

Đã chạy checks, đọc source và tái hiện hai findings. Chỉ thêm hồ sơ review và evidence text, link từ work index. Source/tests/config/package/lockfile, backend và index được giữ nguyên; chưa fix/stage/commit/push.
