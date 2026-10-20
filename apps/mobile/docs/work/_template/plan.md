# <Tên công việc>

## Mục tiêu và phạm vi

Hành vi cần đạt, phần được sửa, phần ngoài phạm vi.

## Nhận diện

- Work/Phase: ...
- Nguồn kế thừa: spec/task cũ, nếu có.
- Phụ thuộc: ...
- Môi trường nghiệm thu cần có: ...

## Nguồn

- Yêu cầu/SRS/quyết định: ...
- Thiết kế hoặc pattern đang dùng: ...
- Contract: ...
- Lịch sử liên quan, ID cũ nếu có: ...

## Hiện trạng trước khi làm

Source đang có gì; phần nào là fixture; dependency nào chưa sẵn sàng.

## Task

- [ ] Việc cụ thể có thể kiểm chứng. Nguồn task cũ nếu chuyển tiếp: ...

Với phase lớn, nhóm task theo sub-phase và dùng cấu trúc ở D/E. Không tạo danh sách task thứ hai ở status.

## Tiêu chí nghiệm thu

- Hành vi quan sát được và môi trường cần xác minh.

## Kiểm tra dự kiến

Focused tests, workspace checks và UI/API/native checks thực sự cần thiết.

## Câu hỏi/dependency

Chỉ ghi vấn đề còn mở; không tự đặt business rule.

## Sub-phase và task

| Mốc                     | Kết quả cần đạt | Phụ thuộc | Task bên dưới  |
| ----------------------- | --------------- | --------- | -------------- |
| S01 Baseline & Contract | ...             | ...       | PNN-S01-T01... |
| S03 Screen Slices       | ...             | ...       | PNN-S03-T01... |
| S99 Review & Acceptance | ...             | ...       | PNN-S99-T01... |

### S03 — <Tên lát cắt>

- [ ] PNN-S03-T01 <Hành vi cần triển khai>
  - Nguồn kế thừa: specNNN/Txxx hoặc Không.
  - Bắt đầu khi: dependency cụ thể, hoặc không có.
  - Phạm vi: feature/routes/components dự kiến, xác minh đường dẫn trước khi sửa.
  - Contract/design: link endpoint/frame/quyết định liên quan.
  - Hành vi đạt: kết quả có thể quan sát.
  - Ca lỗi/lifecycle: các trường hợp thực sự áp dụng.
  - Kiểm chứng: test/UI/API/native nào đủ cho task này.

Task chỉ cần mức chi tiết tương ứng rủi ro; không lặp toàn bộ quy chuẩn chung vào từng task.

## Ma trận hành vi

| Màn/route | Dữ liệu và quyền                 | State chính             | Action/side effect | Back/fallback | Bằng chứng cần |
| --------- | -------------------------------- | ----------------------- | ------------------ | ------------- | -------------- |
| ...       | Real API / preview, owner/public | loading/empty/error/... | ...                | ...           | ...            |

## Nguồn thiết kế

- Frame/link/export: ...
- Pattern đang tái sử dụng: ...
- Thiếu hoặc khác thiết kế: ...
- Thay đổi shared component và consumer bị ảnh hưởng: ...

Chỉ tạo references/ khi có ảnh/assets cần lưu. Không invent phiên bản hoặc lời duyệt.

## Kịch bản nghiệm thu

- Môi trường/binary/API: ...
- Loại tài khoản và quyền cần: ...; không ghi credentials thật vào docs.
- Dữ liệu/prerequisite: ...
- Phần có thể tác động dữ liệu/giao dịch cần quyền riêng: ...

| #   | Thao tác                         | Kết quả mong đợi | Bằng chứng cần |
| --- | -------------------------------- | ---------------- | -------------- |
| 1   | Điểm vào và điều kiện ban đầu    | ...              | ...            |
| 2   | Hành động chính                  | ...              | ...            |
| 3   | Ca lỗi/quyền/lifecycle liên quan | ...              | ...            |

Trong status ghi: ai thực hiện nếu biết, thời điểm thật, môi trường, kết quả từng nhóm và giới hạn.
Không có thiết bị/API thì ghi NOT_RUN, không tự coi web preview là UAT native.

## Nợ kỹ thuật và rollback

- Nợ có chủ đích, tác động/ưu tiên/owner: điền nếu có.
- Rollback cho thay đổi đáng kể: nêu cách khôi phục tương thích source/storage/API, không xóa financial record chưa rõ trạng thái.
- Sub-phase bỏ/gộp và lý do: S01 baseline/contract, S02 reuse UI, S03 screen slices, S04 lifecycle, S05 edge cases, S06 verification, S99 review/UAT; chọn theo phạm vi.
- Với payment/recovery, dùng matrix tại [contract](../../contracts/wallet-payments.md), không tự tạo quyền giao dịch thật.
