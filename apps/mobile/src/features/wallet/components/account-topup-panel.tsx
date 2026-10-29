import { Text, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { PaymentAction as Button } from "./payment-action";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { Copy } from "./wallet-ui";
import { TopupPresets } from "./topup-presets";
import { formatCredit, formatVnd } from "../utils/amount";
import { validateTopUp, topUpPolicy } from "../utils/topup-policy";
import type { PaymentCoordinator } from "../utils/payment-create-coordinator";
import type { PaymentCreateSnapshot } from "../utils/payment-create-state";
import { accountTopupStyles as styles } from "./account-topup-panel.styles";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function AccountTopupPanel({
  model,
  state,
  active,
  onConfirm,
  onReplay,
  stickyAction = false,
  showStatusCheck = true,
}: {
  model: PaymentCoordinator;
  state: PaymentCreateSnapshot;
  active: boolean;
  onConfirm?: () => void;
  onReplay?: () => void;
  stickyAction?: boolean;
  showStatusCheck?: boolean;
}) {
  let estimate: string | undefined;
  try {
    estimate = formatCredit(validateTopUp(state.draft).estimatedCredit);
  } catch {
    /* Incomplete input. */
  }
  const editable = active && !state.busy;
  const minimum = formatVnd(topUpPolicy.minimum).replace(" VND", "");

  return (
    <View testID="wallet-topup-form" style={styles.stack}>
      {state.stage === "draft" && (
        <>
          <View style={[styles.card, styles.draftCard]}>
            <Input
              label="Số tiền nạp"
              labelStyle={styles.inputLabel}
              placeholder="Ví dụ: 100000"
              value={state.draft}
              onChangeText={model.edit}
              editable={editable}
              inputMode="numeric"
              keyboardType="number-pad"
              hint={`${minimum}–${formatVnd(topUpPolicy.maximum)} · Bước ${formatVnd(topUpPolicy.step)}`}
              error={
                state.notice
                  ? `Số tiền từ ${minimum} đến ${formatVnd(topUpPolicy.maximum)}, theo bước ${formatVnd(topUpPolicy.step)}.`
                  : undefined
              }
              fieldStyle={styles.currencyField}
              rightAccessory={<Text style={styles.currency}>VND</Text>}
              style={styles.amount}
            />
            <View style={styles.estimate}>
              <View style={styles.estimateSummary}>
                <Text style={styles.estimateLabel}>Credit ước tính:</Text>
                <Text style={styles.estimateValueCompact}>
                  {estimate ?? "—"}
                </Text>
              </View>
              <Text style={styles.rate}>
                {formatVnd(topUpPolicy.vndPerCredit).replace(" VND", " đ")} = 1
                CR
              </Text>
            </View>
            <View style={styles.presetSection}>
              <Text style={styles.presetHeading}>Chọn nhanh số tiền:</Text>
              <TopupPresets
                value={state.draft}
                disabled={!editable}
                onSelect={model.edit}
              />
            </View>
          </View>
          <PaymentMethodCard />
        </>
      )}
      {state.stage === "review" && state.review && (
        <>
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.heading}>
              Kiểm tra thông tin nạp
            </Text>
          </View>
          <View style={styles.card}>
            <View style={styles.reviewAmount}>
              <Text style={styles.reviewLabel}>Số tiền thanh toán</Text>
              <Text selectable style={styles.total}>
                {formatVnd(state.review.amountVnd)}
              </Text>
            </View>
            <View style={styles.estimate}>
              <View style={styles.grow}>
                <Text style={styles.estimateLabel}>Credit ước tính</Text>
                <Text style={styles.estimateValue}>
                  {formatCredit(state.review.estimatedCredit)}
                </Text>
              </View>
            </View>
            {!stickyAction && (
              <>
                <Button
                  variant="craft"
                  icon="arrow"
                  disabled={!editable}
                  onPress={() => {
                    if (onConfirm) onConfirm();
                    else void model.confirm();
                  }}
                >
                  Xác nhận và tạo mã QR
                </Button>
                <Button
                  variant="ghost"
                  disabled={!editable}
                  onPress={model.back}
                >
                  Đổi số tiền
                </Button>
              </>
            )}
          </View>
          <PaymentMethodCard />
        </>
      )}
      {state.stage === "known" && state.payment && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Yêu cầu nạp của bạn
          </Text>
          <InfoRow
            label="Số tiền nạp"
            value={formatVnd(state.payment.paymentAmountVnd)}
          />
          <InfoRow
            label="Credit"
            value={formatCredit(state.payment.creditAmount)}
          />
          {state.notice && (
            <Copy muted>
              Một số thông tin chưa cập nhật xong. Tiếp tục yêu cầu hiện tại để
              kiểm tra.
            </Copy>
          )}
        </View>
      )}
      {state.stage === "unknown" && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Đang kiểm tra yêu cầu
          </Text>
          <Copy>
            Chưa nhận được kết quả. Tiếp tục yêu cầu hiện tại để tránh nạp
            trùng.
          </Copy>
          {state.canReplay && (
            <Button
              variant="craft"
              disabled={!editable}
              onPress={() => {
                if (onReplay) onReplay();
                else void model.replay();
              }}
            >
              Tiếp tục thanh toán
            </Button>
          )}
        </View>
      )}
      {state.stage === "blocked" && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Chưa thể tiếp tục
          </Text>
          <Copy>
            {showStatusCheck
              ? "Bạn có thể kiểm tra yêu cầu đang mở hoặc quay lại ví và thử sau."
              : "Yêu cầu nạp chưa sẵn sàng. Bạn có thể quay lại ví và thử sau."}
          </Copy>
          {showStatusCheck &&
            (state.readTargetId || state.canReturnToDraft) && (
              <Button
                variant="paper"
                disabled={!editable}
                onPress={() => {
                  void model.check();
                }}
              >
                Kiểm tra yêu cầu đang mở
              </Button>
            )}
          {state.canReturnToDraft && (
            <Button variant="ghost" disabled={!editable} onPress={model.back}>
              Đổi số tiền
            </Button>
          )}
        </View>
      )}
      {state.canRestore && (
        <Button
          variant="paper"
          disabled={!editable}
          onPress={() => {
            void model.bootstrap();
          }}
        >
          Thử khôi phục yêu cầu đã lưu
        </Button>
      )}
      {state.busy && (
        <View style={styles.loading}>
          <ActivityIndicator presentation="silent" />
          <Copy muted>Đang xử lý…</Copy>
        </View>
      )}
    </View>
  );
}

function PaymentMethodCard() {
  return (
    <View style={styles.methodSection}>
      <View style={styles.methodHeading}>
        <Text accessibilityRole="header" style={styles.subheading}>
          Phương thức thanh toán
        </Text>
        <Text style={styles.methodBadge}>payOS</Text>
      </View>
      <View style={styles.methodCard}>
        <View style={styles.methodIcon}>
          <Icon name="qr-code" color={colors.brand} size={20} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.methodTitle}>QR ngân hàng</Text>
          <Text style={styles.methodCaption}>
            Quét bằng ứng dụng ngân hàng.
          </Text>
        </View>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}
