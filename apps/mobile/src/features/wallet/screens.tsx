import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { z } from "zod";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import { DataForm, integerRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  Metric,
  RouteButton,
  ui,
} from "@/components/feature-page";
import { transactions } from "./fixtures";
export function WalletScreen() {
  return (
    <FeaturePage
      title="Ví Credit"
      back="/profile"
      subtitle="Credit dùng để học và chia sẻ trên SkillHub."
    >
      <Panel title="Ví tài khoản mẫu" accent>
        <View style={ui.row}>
          <Metric label="Khả dụng" value="180.00 CR" />
          <Metric label="Đang tạm giữ" value="100.00 CR" />
        </View>
        <Copy muted>
          Đây là số dư minh họa của kịch bản UI, không phản ánh tài khoản đang
          đăng nhập. Ví người mới bắt đầu từ 0.
        </Copy>
        <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>
      </Panel>
      <Panel title="Credit đang giữ">
        <Copy>React thực hành · ONE_WAY · 100 CR từ người học</Copy>
        <RouteButton secondary href="/paths/path-active">
          Xem Learning Path
        </RouteButton>
      </Panel>
      <RouteButton secondary href="/wallet/history">
        Lịch sử giao dịch
      </RouteButton>
      <Copy muted>
        1.000 VND = 1 Credit. Credit sử dụng trong SkillHub và không có chức
        năng rút tiền.
      </Copy>
    </FeaturePage>
  );
}
export function TopupScreen() {
  const router = useRouter();
  const [preset, setPreset] = useState("100000");
  return (
    <FeaturePage title="Nạp Credit" back="/wallet">
      <Panel title="Chọn số tiền nạp">
        <ChoiceGroup
          label="Gói minh họa (VND)"
          options={["50000", "100000", "200000", "500000"]}
          value={preset}
          onChange={setPreset}
        />
        <DataForm
          key={preset}
          defaults={{ amount: preset }}
          fields={[
            {
              name: "amount",
              label: "Số tiền (VND)",
              rule: integerRule(1000).refine(
                (v) => Number(v) % 1000 === 0,
                "Bản xem thử dùng bội số 1.000 VND.",
              ),
              numeric: true,
            },
          ]}
          submitLabel="Chọn phương thức"
          onSubmit={(v) =>
            router.push({
              pathname: "/wallet/payment",
              params: { amount: v.amount },
            })
          }
        />
        <Copy muted>
          Tỷ lệ hiện hành 1.000 VND/CR. Backend xác định số Credit cuối cùng và
          giới hạn giao dịch.
        </Copy>
      </Panel>
    </FeaturePage>
  );
}
export function PaymentScreen() {
  const { amount = "" } = useLocalSearchParams<{ amount: string }>();
  const [confirm, setConfirm] = useState(false);
  const valid =
    /^\d+$/.test(amount) &&
    Number.isSafeInteger(Number(amount)) &&
    Number(amount) >= 1000 &&
    Number(amount) % 1000 === 0;
  return (
    <FeaturePage
      title={confirm ? "Xác nhận nạp Credit" : "Phương thức thanh toán"}
      back="/wallet/topup"
    >
      {!valid ? (
        <EmptyState
          title="Số tiền không hợp lệ"
          description="Quay lại chọn số tiền nạp."
        />
      ) : (
        <Panel title={confirm ? "Kiểm tra giao dịch" : "Cổng thanh toán mẫu"}>
          <Copy>
            {Number(amount).toLocaleString("vi-VN")} VND ·{" "}
            {Number(amount) / 1000} CR ước tính
          </Copy>
          {confirm ? (
            <>
              <Copy>
                Phương thức: cổng sandbox minh họa. Không thu tiền thật và không
                điều hướng ra cổng thanh toán.
              </Copy>
              <RouteButton
                href={{
                  pathname: "/wallet/payment-status",
                  params: { state: "pending", amount },
                }}
              >
                Mở trạng thái chờ xác minh mẫu
              </RouteButton>
              <RouteButton secondary href="/wallet/topup">
                Thay đổi số tiền
              </RouteButton>
            </>
          ) : (
            <DataForm
              fields={[
                {
                  name: "gateway",
                  label: "Phương thức xem thử",
                  rule: z.string().min(1, "Chọn phương thức."),
                  choices: ["Cổng sandbox minh họa"],
                },
              ]}
              submitLabel="Tiếp tục"
              onSubmit={() => setConfirm(true)}
            />
          )}
        </Panel>
      )}
      <Copy muted>
        Chỉ callback/webhook đã xác minh mới tạo TOP_UP. Quay về từ cổng thanh
        toán không phải bằng chứng đã trả tiền.
      </Copy>
    </FeaturePage>
  );
}
const paymentStates = {
  pending: [
    "Đang chờ xác minh",
    "Chưa nhận kết quả xác minh từ cổng thanh toán. Credit chưa được cộng.",
  ],
  success: [
    "Thanh toán mẫu thành công",
    "Snapshot minh họa đã được xác minh. Bản xem thử không thay đổi ví thật.",
  ],
  failed: [
    "Thanh toán thất bại",
    "Snapshot mẫu không hoàn tất thanh toán. Bạn có thể chọn lại số tiền và thử lại.",
  ],
  expired: [
    "Thanh toán đã hết hạn",
    "Snapshot mẫu quá hạn. Kiểm tra lịch sử trước khi tạo giao dịch mới.",
  ],
} as const;
export function PaymentStatusScreen() {
  const { state = "pending" } = useLocalSearchParams<{ state: string }>();
  const item = paymentStates[state as keyof typeof paymentStates];
  return (
    <FeaturePage title="Trạng thái thanh toán" back="/wallet">
      <Panel title={item?.[0] ?? "Không tìm thấy giao dịch"}>
        <Copy>{item?.[1] ?? "Mã trạng thái không hợp lệ."}</Copy>
        <RouteButton secondary href="/wallet/history">
          Kiểm tra lịch sử
        </RouteButton>
        <RouteButton href="/wallet/topup">Tạo giao dịch mẫu mới</RouteButton>
      </Panel>
    </FeaturePage>
  );
}
export function TransactionsScreen() {
  const [filter, setFilter] = useState("Tất cả");
  const items = transactions.filter(
    (t) => filter === "Tất cả" || t.status === filter,
  );
  return (
    <FeaturePage title="Lịch sử giao dịch" back="/wallet">
      <ChoiceGroup
        label="Trạng thái"
        options={["Tất cả", "SUCCESS", "PENDING", "FAILED"]}
        value={filter}
        onChange={setFilter}
      />
      {items.map((t) => (
        <Panel key={t.id} title={`${t.type} · ${t.amount} CR`}>
          <Badge label={t.status} />
          <Copy muted>{t.reference}</Copy>
          <RouteButton secondary href={`/wallet/transactions/${t.id}`}>
            Xem giao dịch
          </RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Không có giao dịch"
          description="Thử trạng thái khác."
        />
      )}
    </FeaturePage>
  );
}
export function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = transactions.find((i) => i.id === id);
  return (
    <FeaturePage title="Chi tiết giao dịch" back="/wallet/history">
      {!t ? (
        <EmptyState
          title="Không tìm thấy giao dịch"
          description="Không có trong dữ liệu mẫu."
        />
      ) : (
        <Panel title={t.type}>
          <Badge label={t.status} />
          <Metric label="Số Credit" value={t.amount} />
          <Copy>Mã giao dịch: {t.id}</Copy>
          <Copy>Tham chiếu: {t.reference}</Copy>
          <Copy>{t.description}</Copy>
          {t.reference.startsWith("path-") && (
            <RouteButton secondary href={`/paths/${t.reference}`}>
              Xem Learning Path liên quan
            </RouteButton>
          )}
        </Panel>
      )}
    </FeaturePage>
  );
}
