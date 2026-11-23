import { Text, View, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useRedemption } from "../hooks/use-rewards";
import { useVoucherSecret } from "../hooks/use-voucher-secret";
import { RewardLogo } from "../components/reward-card";
import {
  creditLabel,
  vndLabel,
  redemptionLabel,
  rewardFailure,
  safeVoucherLink,
} from "../utils/reward-presentation";
import { rewardStyles as s } from "../components/reward.styles";

export function VoucherReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useConnections();
  return (
    <ReceiptContent
      key={JSON.stringify([runtime.key, id])}
      id={typeof id === "string" ? id : ""}
    />
  );
}
function ReceiptContent({ id }: Readonly<{ id: string }>) {
  const query = useRedemption(id);
  const vault = useVoucherSecret(id);
  const row = query.data;
  const runtime = useConnections();
  const [linkError, setLinkError] = useState(false);
  const url = safeVoucherLink(vault.secret?.link);
  const expired = !!row?.expiresAt && Date.parse(row.expiresAt) <= Date.now();
  const usable =
    row?.status === "ISSUED" && !expired && !query.error && !query.isFetching;
  return (
    <FeaturePage
      title="Voucher của tôi"
      back={{ pathname: "/vouchers", params: { tab: "mine" } }}
      backBehavior="history"
      onRefresh={() => {
        vault.hide();
        void query.refetch();
      }}
      refreshing={query.isRefetching}
    >
      {!uuid.safeParse(id).success && (
        <FormNotice tone="error">Đường dẫn voucher không hợp lệ.</FormNotice>
      )}
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={() => query.refetch()}
      />
      {row && (
        <>
          <View style={s.detailHero}>
            <View style={s.row}>
              <RewardLogo
                name={row.product.brandName}
                uri={row.product.brandLogoUrl}
              />
              <View style={s.grow}>
                <Text style={s.heading}>{row.product.brandName}</Text>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{redemptionLabel(row)}</Text>
                </View>
              </View>
            </View>
            <Text style={s.detailAmount}>{vndLabel(row.faceValueVnd)}</Text>
            <Text style={s.title}>{row.product.name}</Text>
          </View>
          <Panel title="Thông tin đổi">
            <Copy>Đã đổi: {creditLabel(row.priceCredit)}</Copy>
            <Copy>
              Ngày đổi: {new Date(row.createdAt).toLocaleString("vi-VN")}
            </Copy>
            <Copy>
              Hạn sử dụng:{" "}
              {row.expiresAt
                ? new Date(row.expiresAt).toLocaleDateString("vi-VN")
                : "Chưa có thông tin"}
            </Copy>
          </Panel>
          {row.status === "ISSUING" && (
            <FormNotice tone="info">
              Yêu cầu đã được tiếp nhận, voucher đang được phát hành. Làm mới để
              kiểm tra; không cần đổi lại.
            </FormNotice>
          )}
          {row.status === "MANUAL_REVIEW" && (
            <FormNotice tone="warning">
              Yêu cầu đang được nhân sự kiểm tra. Credit chưa được hoàn; vui
              lòng theo dõi tại đây.
            </FormNotice>
          )}
          {["FAILED_REFUNDED", "REFUNDED_MANUAL"].includes(row.status) && (
            <FormNotice tone="info">
              Giao dịch đã được hoàn Credit theo trạng thái từ hệ thống. Kiểm
              tra số dư tại Ví Credit.
            </FormNotice>
          )}
          {usable && (
            <Panel title="Mã voucher">
              {vault.secret ? (
                <>
                  {!!vault.secret.code && (
                    <Text selectable style={s.secret}>
                      {vault.secret.code}
                    </Text>
                  )}
                  {!!vault.secret.pin && <Copy>PIN: {vault.secret.pin}</Copy>}
                  <Copy muted>
                    Chạm giữ mã để chọn và sao chép. Không chia sẻ mã hoặc PIN
                    cho người khác.
                  </Copy>
                  {!!url && (
                    <Button
                      variant="paper"
                      onPress={() => {
                        setLinkError(false);
                        void Linking.openURL(url).catch(() => {
                          if (runtime.isCurrent()) setLinkError(true);
                        });
                      }}
                    >
                      Mở liên kết voucher
                    </Button>
                  )}
                  {linkError && (
                    <FormNotice tone="error" compact>
                      Chưa mở được liên kết. Vui lòng thử lại.
                    </FormNotice>
                  )}
                  <Button variant="ghost" onPress={vault.hide}>
                    Ẩn mã
                  </Button>
                </>
              ) : (
                <>
                  <Copy muted>Nhấn bên dưới để xem mã voucher của bạn.</Copy>
                  <Button
                    variant="craft"
                    disabled={vault.pending}
                    onPress={() => {
                      void vault.reveal();
                    }}
                  >
                    {vault.pending ? "Đang lấy mã…" : "Hiện mã voucher"}
                  </Button>
                </>
              )}
              {!!vault.error && (
                <FormNotice tone="error" compact>
                  {rewardFailure(vault.error)}
                </FormNotice>
              )}
            </Panel>
          )}
          {expired && (
            <FormNotice tone="warning">
              Voucher đã hết hạn theo thông tin nhà cung cấp.
            </FormNotice>
          )}
          <Button
            variant="paper"
            onPress={() => {
              vault.hide();
              void query.refetch();
            }}
            disabled={query.isFetching}
          >
            Làm mới trạng thái
          </Button>
        </>
      )}
    </FeaturePage>
  );
}
