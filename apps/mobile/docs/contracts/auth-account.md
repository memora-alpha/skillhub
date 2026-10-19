# Auth và account

## Nguồn và mức tích hợp

Backend: [identity HTTP](../../../../services/api/specs/002-user-identity/contracts/http.md), [AuthController](../../../../services/api/src/modules/auth/presentation/http/auth.controller.ts) và [Auth DTO](../../../../services/api/src/modules/auth/presentation/http/auth.dto.ts). Mobile: [auth-api](../../src/features/auth/api/auth-api.ts), [auth contracts](../../src/features/auth/api/auth-contracts.ts), [account-api](../../src/features/account/api/account-api.ts), [SessionController](../../src/features/auth/context/session-controller.ts). Đã đối chiếu working tree tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd. Backend có source; mobile đã nối; deployed API/thiết bị không được kiểm lại trong migration.

## Routes và dữ liệu

Base /api/v1; không gọi admin/Google routes để mô phỏng login.

| Method/path                    | Auth và input                                             | Response / lỗi quan trọng                                              |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| POST /auth/register            | Guest: fullName,email,password,confirmPassword,agreeTerms | 202 neutral data:null                                                  |
| POST /auth/verification/resend | Guest: email                                              | 202 neutral                                                            |
| POST /auth/verification/verify | Guest: email,otpCode sáu chữ số                           | 204; 400 OTP_INVALID_OR_EXPIRED                                        |
| POST /auth/login               | Guest: email,password,rememberMe?                         | 200 TokenPair; 401 INVALID_CREDENTIALS,403 ACCOUNT_NOT_ACTIVE,429      |
| POST /auth/refresh             | refreshToken                                              | 200 TokenPair mới; strict rotation,401 invalid/replay                  |
| POST /auth/logout              | refreshToken                                              | 204 neutral/idempotent                                                 |
| POST /auth/logout-all          | Bearer, body rỗng                                         | 204, không phải device-list API                                        |
| POST /auth/password/forgot     | Guest hoặc email cố định từ Settings                      | 202 neutral, dùng lại để resend recovery                               |
| POST /auth/password/verify-otp | email,otpCode                                             | 200 {resetToken,expiresAt}; chưa đổi password                          |
| POST /auth/password/reset      | email,resetToken,newPassword,confirmNewPassword           | 204; 400 RESET_TOKEN_INVALID_OR_EXPIRED; không nhận otpCode ở bước này |
| GET /me                        | Bearer                                                    | OwnIdentity {userId,email,emailVerified,accountStatus,roles,profile}   |

TokenPair: accessToken,refreshToken,tokenType,expiresIn,refreshExpiresAt. Profile shape và PATCH thuộc [profile](profile.md). Các route này không pagination/upload/realtime; không gắn Idempotency-Key nếu contract không có.

## Semantics cần giữ

Register stage draft mã hóa Redis, TTL5 phút; chỉ verify thành công mới tạo account theo backend hiện tại. Resend không phục hồi draft hết hạn. Cooldown60 giây và tối đa5 issue/UTC giờ/email/purpose; neutral202 không chứng minh mail đã gửi. Sai5 mã xuyên purpose/challenge softban email24 giờ, không LOCKED account hoặc cấm password login. Backend che invalid/expired/blocked bằng400 OTP_INVALID_OR_EXPIRED; không có retryAfter/unblock time cho app dựng countdown24 giờ.

Reset proof một lần, memory-only, expiresAt phải kiểm; OTP replacement vô hiệu proof cũ. Reset network/5xx có thể xảy ra sau commit: giữ input, gợi ý login; không khẳng định password chưa đổi và không retry tự động. Signed-in reset thành công clear session; completion cũ không expire phiên mới.

Auth renewal single-flight, access RAM, native refresh SecureStore, web memory-only; ambiguous rotation không replay token có thể đã consume. Ownership/generation và cache cleanup chuẩn nằm tại [state/session](../guides/state-and-session.md). Current SessionController states: bootstrapping,guest,ready,offline,reauth; ready không phải wire account status.

## Yêu cầu / chênh lệch / evidence

SRS18.2/18.3/18.4 mô tả PENDING_VERIFICATION và OTP_EMAIL_COOLDOWN429 có retryAfterSeconds/cooldownUntil; identity contract thực tế stage registration Redis và neutral400 OTP_INVALID_OR_EXPIRED. Giữ hai nguồn, không đổi client để giả expose dữ liệu backend không trả. Cần product/API owner chốt nếu mở lại contract; migration không thay rule.

Nguồn yêu cầu: [domain rules](../domain-rules.md). [Spec002 tasks](../../specs/002-auth-account-shell/tasks.md) giữ provider/storage/integration coverage, real mailbox/recovery expiry/replay, native keyboard/autofill/cold start/logout và account-hook extraction chưa xong; không tạo work mới cho toàn bộ lịch sử. [Validation002](../../specs/002-auth-account-shell/validation.md) có kết quả được ghi nhận ở lần chạy trước (2026-10-09) và giới hạn CORS lúc đó; không suy CORS deployment hiện nay. Không có evidence mới về email/thiết bị trong migration.
