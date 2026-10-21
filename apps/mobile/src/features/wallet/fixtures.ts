export const transactions = [
  {
    id: "tx-topup",
    type: "TOP_UP",
    amount: "+200.00",
    after: "200.00",
    status: "SUCCESS",
    reference: "PAY-DEMO-001",
    description:
      "Snapshot nạp Credit đã được backend xác minh trong dữ liệu mẫu.",
  },
  {
    id: "tx-hold",
    type: "HOLD",
    amount: "-100.00",
    after: "100.00",
    status: "SUCCESS",
    reference: "path-active",
    description: "Tạm giữ toàn bộ giá dạy một chiều. Chỉ người học tạm giữ.",
  },
  {
    id: "tx-teaching",
    type: "TEACHING_EARNING",
    amount: "+96.00",
    after: "196.00",
    status: "SUCCESS",
    reference: "path-completed",
    description:
      "Thu nhập người dạy ở cuối Learning Path; không phát sinh theo từng buổi.",
  },
  {
    id: "tx-fee",
    type: "PLATFORM_FEE",
    amount: "-4.00",
    after: "196.00",
    status: "SUCCESS",
    reference: "path-completed",
    description:
      "Snapshot phí 4% của Learning Path. Giao dịch mẫu minh họa riêng; không dùng để cộng sổ cái của bạn.",
  },
  {
    id: "tx-pending",
    type: "TOP_UP",
    amount: "+100.00",
    after: "—",
    status: "PENDING",
    reference: "PAY-DEMO-002",
    description: "Chờ cổng thanh toán xác minh. Chưa cộng số dư.",
  },
];
