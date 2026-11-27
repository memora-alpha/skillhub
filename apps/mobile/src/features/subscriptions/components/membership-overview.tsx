import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { SubscriptionFeedback } from "./subscription-feedback";
import { appColors } from "@/constants/theme";
import type {
  Membership,
  SubscriptionUpdate,
} from "../api/subscription-contracts";
import {
  dateLabel,
  intervalName,
  planName,
  storageLabel,
  usagePercent,
} from "../utils/subscription-presentation";
import { manageStyles as s } from "./manage-membership.styles";

type OverviewProps = Readonly<{
  membership: Membership;
  disabled: boolean;
  onUpdate: (
    body: SubscriptionUpdate,
    title: string,
    description: string,
  ) => void;
  onBrowsePlans: () => void;
  onOpenWallet: () => void;
}>;

export function MembershipOverview({
  membership,
  disabled,
  onUpdate,
  onBrowsePlans,
  onOpenWallet,
}: OverviewProps) {
  const { subscription: current, usage, materialStorage: storage } = membership;
  const remaining = usage
    ? Math.max(0, usage.recordingMinutesAllowed - usage.recordingMinutesUsed) +
      usage.addonMinutesRemaining
    : 0;
  const overQuota =
    storage.enforced &&
    BigInt(storage.usedBytes) > BigInt(storage.allowedBytes);
  return (
    <>
      <View style={s.planCard}>
        <View style={s.row}>
          <View style={s.planIcon}>
            <Icon name="award" size={23} color={appColors.brand} />
          </View>
          <View style={s.grow}>
            <Text accessibilityRole="header" style={s.planName}>
              {planName(current?.planCode)}
            </Text>
            <Text style={s.statusText}>
              {current?.status === "GRACE" ? "Chờ gia hạn" : "Đang dùng"}
            </Text>
          </View>
          {current && (
            <Button
              variant="paper"
              size="sm"
              accessibilityLabel="Thay đổi gói thành viên"
              onPress={onBrowsePlans}
            >
              Đổi gói
            </Button>
          )}
        </View>
        {current && (
          <View style={s.planMeta}>
            <View style={s.metaCell}>
              <Text style={s.caption}>Chu kỳ</Text>
              <Text style={s.value}>{intervalName(current.interval)}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.caption}>Kết thúc kỳ</Text>
              <Text style={s.value}>{dateLabel(current.termEnd)}</Text>
            </View>
          </View>
        )}
      </View>
      {current?.status === "GRACE" && (
        <SubscriptionFeedback>
          {current.autoRenew
            ? `Chưa gia hạn thành công. Quyền lợi được giữ đến ${current.graceUntil ? dateLabel(current.graceUntil) : "hết thời gian chờ"}. Hãy kiểm tra Credit trong ví.`
            : "Đã hủy gia hạn. Gói đang chờ kết thúc."}
        </SubscriptionFeedback>
      )}
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.heading}>
          Mức sử dụng
        </Text>
        <UsageMeter
          icon="book"
          title="Tài liệu"
          value={`${storageLabel(storage.usedBytes)} / ${storageLabel(storage.allowedBytes)}`}
          detail={storage.enforced ? undefined : "Chưa áp dụng hạn mức"}
          percent={usagePercent(storage.usedBytes, storage.allowedBytes)}
        />
        {overQuota && (
          <SubscriptionFeedback>
            Đã vượt hạn mức. Tài liệu hiện có vẫn được giữ; hãy giải phóng dung
            lượng hoặc đổi gói để tải thêm.
          </SubscriptionFeedback>
        )}
        {usage && (
          <>
            <View style={s.divider} />
            <UsageMeter
              icon="video"
              title="Ghi hình"
              value={`${remaining} phút còn lại`}
              detail={`Đã dùng ${usage.recordingMinutesUsed} / ${usage.recordingMinutesAllowed} phút trong kỳ`}
              percent={usagePercent(
                String(usage.recordingMinutesUsed),
                String(usage.recordingMinutesAllowed),
              )}
            />
            <View style={s.usageFootnote}>
              <Text style={s.caption}>
                Kỳ hiện tại đến {dateLabel(usage.periodEnd)}
              </Text>
              {usage.addonMinutesRemaining > 0 && (
                <Text style={s.caption}>
                  {usage.addonMinutesRemaining} phút mua thêm còn lại
                </Text>
              )}
            </View>
          </>
        )}
      </View>
      {current && (
        <View style={s.section}>
          <Text accessibilityRole="header" style={s.heading}>
            Gia hạn & thanh toán
          </Text>
          <View style={s.row}>
            <View style={s.smallIcon}>
              <Icon name="refresh" color={appColors.brand} size={18} />
            </View>
            <View style={s.grow}>
              <Text style={s.label}>Tự động gia hạn</Text>
              <Text style={s.caption}>
                {current.autoRenew
                  ? "Gia hạn qua Ví Credit khi hết kỳ"
                  : current.status === "GRACE"
                    ? "Đã hủy gia hạn · đang chờ kết thúc"
                    : "Đã hủy gia hạn · dùng đến hết kỳ"}
              </Text>
            </View>
          </View>
          <View style={s.divider} />
          <Button
            variant="ghost"
            onPress={onOpenWallet}
            style={s.walletAction}
            accessibilityLabel="Mở Ví Credit"
          >
            <View style={s.walletRow}>
              <Icon name="wallet" color={appColors.body} size={18} />
              <Text style={[s.label, s.grow]}>Ví Credit</Text>
              <Icon name="chevron" color={appColors.muted} size={16} />
            </View>
          </Button>
          {(current.scheduledPlanCode || current.scheduledInterval) && (
            <View style={s.scheduled}>
              <Text style={s.label}>Thay đổi đã hẹn</Text>
              <Text style={s.caption}>
                {planName(current.scheduledPlanCode ?? current.planCode)} ·{" "}
                {intervalName(current.scheduledInterval ?? current.interval)} từ
                lần gia hạn tới
                {!current.autoRenew ? ". Cần bật gia hạn để áp dụng." : "."}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onPress={() =>
                  onUpdate(
                    {
                      expectedVersion: current.version,
                      scheduledPlanCode: null,
                      scheduledInterval: null,
                    },
                    "Bỏ thay đổi đã hẹn?",
                    "Giữ gói và chu kỳ hiện tại cho lần gia hạn tiếp theo.",
                  )
                }
              >
                Bỏ thay đổi đã hẹn
              </Button>
            </View>
          )}
          <View style={s.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              current.autoRenew ? "Hủy tự động gia hạn" : "Tiếp tục gia hạn"
            }
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() =>
              onUpdate(
                {
                  expectedVersion: current.version,
                  autoRenew: !current.autoRenew,
                },
                current.autoRenew
                  ? "Hủy tự động gia hạn?"
                  : "Tiếp tục gia hạn?",
                current.autoRenew
                  ? current.status === "GRACE"
                    ? "Kỳ thanh toán đã hết. Hủy gia hạn sẽ kết thúc gói ở lần xử lý tiếp theo. Credit đã thanh toán không được hoàn."
                    : `Gói ${planName(current.planCode)} vẫn dùng đến ${dateLabel(current.termEnd)} và sẽ không tự gia hạn. Credit đã thanh toán không được hoàn.`
                  : current.status === "GRACE"
                    ? "Hệ thống sẽ tiếp tục thử gia hạn từ Ví Credit theo giá có hiệu lực."
                    : "Hệ thống sẽ tự trừ Credit để gia hạn theo giá có hiệu lực ở kỳ tiếp theo.",
              )
            }
            style={({ pressed }) => [
              s.renewalAction,
              (pressed || disabled) && { opacity: 0.5 },
            ]}
          >
            <Text style={[s.renewalLabel, current.autoRenew && s.cancelLabel]}>
              {current.autoRenew ? "Hủy tự động gia hạn" : "Tiếp tục gia hạn"}
            </Text>
            <Icon
              name="chevron"
              size={16}
              color={current.autoRenew ? appColors.error : appColors.brand}
            />
          </Pressable>
        </View>
      )}
    </>
  );
}

function UsageMeter({
  icon,
  title,
  value,
  detail,
  percent,
}: Readonly<{
  icon: IconName;
  title: string;
  value: string;
  detail?: string;
  percent: number;
}>) {
  return (
    <View style={s.meter}>
      <View style={s.row}>
        <View style={s.smallIcon}>
          <Icon name={icon} color={appColors.brand} size={18} />
        </View>
        <View style={s.grow}>
          <Text style={s.label}>{title}</Text>
          {!!detail && <Text style={s.caption}>{detail}</Text>}
        </View>
      </View>
      <View style={s.meterContent}>
        <Text style={s.value}>{value}</Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${title}: ${value}`}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: percent,
            text: `Đã sử dụng ${percent}% hạn mức`,
          }}
          style={s.progress}
        >
          <View style={[s.progressFill, { width: `${percent}%` }]} />
        </View>
      </View>
    </View>
  );
}
