# Validation guide Session

Phần mobile đã triển khai ngày 2026-10-14; kết quả tests/web ở [validation](validation.md).
API thật hai account và Android/iOS chưa nghiệm thu; guide dưới đây dùng để tiếp tục kiểm chứng.

## Chuẩn bị

- Dependency/API URL theo README mobile và ignored .env, không ghi credential vào artifacts.
- Hai account participant, buổi tương lai còn hơn 60 phút, buổi đã endAt và buổi blocked/cancelled có đủ graph lịch. Theo yêu cầu bổ sung ngày 2026-10-14, đã seed fixture PostgreSQL local như phần dưới; không thay đổi logic backend.
- Smoke detail sớm: response JSON/id/participant đúng. Nếu lỗi serialization thì ghi GAP-03, không sửa backend.
- US4 cần read contract và evidence GAP-02. Khi thiếu, nghiệm thu UI unavailable và không POST, chưa nghiệm thu đổi lịch thật.

## Fixture PostgreSQL local

Đã có `teacher.session@skillhub.test` và `learner.session@skillhub.test`, cùng tham gia
8 buổi trong 3 path và có ca đổi vai. Mật khẩu ngẫu nhiên dùng chung ở ignored
`apps/mobile/.expo/session-seed-credentials.json`; ID, ngày giờ và trạng thái ở
`.expo/session-seed-manifest.json`. Chọn ngày hôm nay để thử buổi đã kết thúc chưa
xác nhận; chọn ngày kế tiếp để xem buổi sắp tới. Ngày giờ tính từ database clock
khi seed lần đầu, không tự cập nhật khi chạy lại.

Dữ liệu đã ghi trực tiếp vào database `skillhub`, schema `public`. Kiểm tra trong
pgAdmin hoặc SQL client:

```sql
SELECT * FROM public.sessions
WHERE path_id::text LIKE '00600600-%'
ORDER BY start_at;
```

Theo yêu cầu không chỉnh sửa BE, file seed tạm đã được gỡ khỏi `services/api`.
Dữ liệu PostgreSQL giữ nguyên; không cần chạy seed thêm. Dữ liệu này không chứng
minh detail HTTP đã qua GAP-03.

## Checks sau implement

Chạy từ apps/mobile:

```powershell
npm run lint
npm run check-types
npm run check-structure
npm test
npm run web
```

Focused tests đã có, dùng runner hiện có:

```powershell
npx tsx --test tests/sessions-list.test.ts tests/sessions-detail.test.ts tests/sessions-completion.test.ts tests/sessions-reschedule-availability.test.ts
```

Projection/participant, denial cache, dual completion, timezone/tháng/cap 100,
double tap và uncertain recovery được kiểm bằng fixtures. Stale-version/dual-confirm
đổi lịch thật chờ read contract; chưa có suite `sessions-reschedule.test.ts` cho phần gated.

## Journeys

1. **List/detail**: đúng vai trò của hai account, empty đúng; 403/404 không cache private; API lỗi không fallback mock.
2. **Timezone**: Asia/Ho_Chi_Minh và UTC, qua nửa đêm/cuối tháng; lọc ngày startAt và instant nhất quán. 100 rows có cảnh báo, không total/history đầy đủ giả.
3. **Complete**: một confirm → chờ, đủ hai → COMPLETED từ server; trước endAt/dispute/cancel không success. Không settlement hoặc local Path mutation.
4. **Recovery**: timeout sau POST/double tap/401/account switch/refetch failure; không replay, giữ receipt success, đọc lại trước retry, account mới không nhận data cũ.
5. **Đổi lịch sau gate**: hai account đọc lại đề xuất sau reload, tác giả chưa tự confirm; đủ confirm cùng version và cutoff → giờ mới từ server.
6. **Boundary**: đúng/dưới 60 phút, thiếu confirm, version đổi, conflict phát sinh trước confirm cuối; giữ lịch cũ khi không được chấp nhận.
7. **Native/navigation**: calendar/direct link/Back, draft khi lỗi, keyboard/labels/font scaling/resume Android/iOS. Session thật không dẫn thao tác preview; gallery Session dùng ID mẫu bị vô hiệu hóa và ghi “Chưa khả dụng”, RoomScreen/provider vẫn giữ contract khi tách.

## Evidence

Cập nhật [validation](validation.md) với revision, commands/results và fixture / API thật / web / Android / iOS riêng. Checklist spec chỉ đánh giá yêu cầu; source/fixture không chứng minh runtime. US4 chưa nghiệm thu khi read/conflict gate mở.
