import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { HomeWalletBalance } from "@/features/wallet";
import { useMaterial, useMaterialOwnership } from "../hooks/use-materials";
import { useMaterialPurchase } from "../hooks/use-material-purchase";
import { materialPrice } from "../utils/owner-material-presentation";
import { materialFailure } from "../utils/material-failure";
import { MaterialSummary } from "../components/material-summary";
import { materialStyles as styles } from "../components/material.styles";

export function MaterialPurchaseScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const runtime = useConnections();
  return <PurchaseContent key={JSON.stringify([runtime.key, id])} id={id} />;
}
function PurchaseContent({ id }: Readonly<{ id: string }>) {
  const query = useMaterial(id);
  const ownership = useMaterialOwnership(id);
  const runtime = useConnections();
  const router = useRouter();
  const command = useMaterialPurchase(id);
  const [refundedReceipt, setRefundedReceipt] = useState(false);
  const material = query.data;
  const bought = !!ownership.data;
  const own = material?.ownerId === runtime.userId;
  const locked =
    query.isFetching ||
    !!query.error ||
    ownership.isFetching ||
    !!ownership.error ||
    ownership.data === undefined ||
    command.pending ||
    command.uncertain;
  const complete = (result: Awaited<ReturnType<typeof command.buy>>) => {
    if (runtime.isCurrent() && result?.status === "REFUNDED")
      setRefundedReceipt(true);
  };
  return (
    <FeaturePage
      title="Mua tài liệu"
      compact
      back={`/materials/${id}`}
      backBehavior="history"
    >
      <ConnectionFeedback
        loading={query.isLoading || ownership.isLoading}
        error={query.error || ownership.error}
        retry={() => {
          void query.refetch();
          void ownership.refetch();
        }}
      />
      {material && (
        <View style={styles.page}>
          <MaterialSummary material={material} />
          {bought || own || material.accessType === "FREE" ? (
            <Button
              variant="craft"
              leadingIcon="download"
              onPress={() => router.replace(`/materials/${id}`)}
            >
              {bought ? "Đã mua · Xem chi tiết" : "Xem chi tiết tài liệu"}
            </Button>
          ) : (
            <>
              <View style={styles.payment}>
                <Text style={styles.sectionTitle}>Thanh toán bằng Credit</Text>
                <View style={styles.row}>
                  <Text style={styles.meta}>Giá tài liệu</Text>
                  <Text style={styles.price}>{materialPrice(material)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.meta}>Số dư khả dụng</Text>
                  <HomeWalletBalance />
                </View>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.title}>Tổng thanh toán</Text>
                  <Text style={styles.priceLarge}>
                    {materialPrice(material)}
                  </Text>
                </View>
                <Button
                  variant="craft"
                  leadingIcon="wallet"
                  disabled={locked || material.status !== "PUBLISHED"}
                  onPress={() => {
                    setRefundedReceipt(false);
                    void command.buy(material).then(complete);
                  }}
                >
                  {command.pending
                    ? "Đang xử lý…"
                    : `Xác nhận mua · ${materialPrice(material)}`}
                </Button>
              </View>
              <Text style={styles.meta}>
                Có thể yêu cầu hoàn tiền trong 24 giờ khi chưa được cấp đường
                dẫn tải. Hệ thống kiểm tra điều kiện khi gửi yêu cầu.
              </Text>
            </>
          )}
          {!!command.error && (
            <FormNotice tone="error" compact>
              {materialFailure(command.error)}
            </FormNotice>
          )}
          {refundedReceipt && (
            <FormNotice tone="info" compact>
              Đơn mua trước đã được hoàn tiền. Kiểm tra thông tin trước khi mua
              lại.
            </FormNotice>
          )}
          {command.uncertain && !bought && (
            <View style={styles.section}>
              <FormNotice tone="warning" compact>
                Chưa xác nhận được thanh toán. Kiểm tra giao dịch trước khi mua
                lại.
              </FormNotice>
              <Button
                variant="paper"
                disabled={command.pending}
                onPress={() => void command.check().then(complete)}
              >
                Kiểm tra giao dịch mua
              </Button>
            </View>
          )}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="wallet"
            onPress={() => router.push("/wallet")}
          >
            Xem ví Credit
          </Button>
        </View>
      )}
    </FeaturePage>
  );
}
