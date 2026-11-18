import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { useMaterial, useMaterialOwnership } from "../hooks/use-materials";
import { useMaterialPurchase } from "../hooks/use-material-purchase";
import { materialPrice } from "../utils/owner-material-presentation";
import { materialFailure } from "../utils/material-failure";
import { MaterialPurchaseOverview } from "../components/material-purchase-overview";
import { materialPurchaseStyles as styles } from "../components/material-purchase.styles";
import { MaterialPurchaseDialog } from "../components/material-purchase-dialog";
import type { ApiMaterial } from "../api/material-contracts";

function purchaseAccessNotice(own: boolean, bought: boolean) {
  if (own) return "Đây là tài liệu của bạn.";
  if (bought) return "Tài liệu đã có trong thư viện của bạn.";
  return "Tài liệu này được chia sẻ miễn phí.";
}

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
  const [purchaseIntent, setPurchaseIntent] = useState<ApiMaterial>();
  const confirming = useRef(false);
  const material = query.data;
  const bought = !!ownership.data;
  const own = material?.ownerId === runtime.userId;
  const needsPurchase =
    !!material && !bought && !own && material.accessType !== "FREE";
  const locked =
    query.isFetching ||
    !!query.error ||
    ownership.isFetching ||
    !!ownership.error ||
    ownership.data === undefined ||
    command.pending ||
    command.uncertain;
  const confirmationStale =
    !!purchaseIntent &&
    (!needsPurchase ||
      !material ||
      material.status !== "PUBLISHED" ||
      purchaseIntent.id !== material.id ||
      purchaseIntent.listingVersion !== material.listingVersion ||
      purchaseIntent.priceCredit !== material.priceCredit ||
      purchaseIntent.title !== material.title);
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
      stickyFooter={
        material && (
          <View style={styles.footer}>
            {needsPurchase ? (
              <>
                <View style={styles.totalRow}>
                  <View style={styles.grow}>
                    <Text style={styles.body}>Tổng thanh toán</Text>
                    <Text style={styles.muted}>Thanh toán một lần</Text>
                  </View>
                  <Text style={styles.total}>{materialPrice(material)}</Text>
                </View>
                {command.uncertain ? (
                  <Button
                    variant="paper"
                    leadingIcon="refresh"
                    disabled={command.pending}
                    accessibilityState={{ busy: command.pending }}
                    onPress={() => void command.check().then(complete)}
                  >
                    {command.pending
                      ? "Đang kiểm tra…"
                      : "Kiểm tra giao dịch mua"}
                  </Button>
                ) : (
                  <Button
                    variant="craft"
                    leadingIcon="wallet"
                    disabled={
                      locked ||
                      !!purchaseIntent ||
                      material.status !== "PUBLISHED"
                    }
                    accessibilityLabel={`Xác nhận mua · ${materialPrice(material)}`}
                    accessibilityState={{ busy: command.pending }}
                    onPress={() => {
                      if (
                        locked ||
                        purchaseIntent ||
                        material.status !== "PUBLISHED"
                      )
                        return;
                      setPurchaseIntent(material);
                    }}
                  >
                    {command.pending ? "Đang xử lý…" : "Xác nhận mua"}
                  </Button>
                )}
                <Text style={styles.footnote}>
                  Mua thành công, tài liệu sẽ có trong Thư viện.
                </Text>
              </>
            ) : (
              <Button
                variant="craft"
                leadingIcon="book"
                onPress={() => router.replace(`/materials/${id}`)}
              >
                {bought ? "Đã mua · Xem chi tiết" : "Xem chi tiết tài liệu"}
              </Button>
            )}
          </View>
        )
      }
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
          <MaterialPurchaseOverview
            material={material}
            needsPurchase={needsPurchase}
            walletDisabled={command.pending || command.uncertain}
            onWallet={() => router.push("/wallet")}
          />
          {!needsPurchase && (
            <FormNotice tone="info" compact>
              {purchaseAccessNotice(own, bought)}
            </FormNotice>
          )}
          {needsPurchase && material.status !== "PUBLISHED" && (
            <FormNotice tone="info" compact>
              Tài liệu hiện chưa được mở bán. Quay lại trang chi tiết để kiểm
              tra.
            </FormNotice>
          )}
          {!!command.error && !command.uncertain && (
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
            <FormNotice tone="warning" compact>
              Chưa xác nhận được thanh toán. Kiểm tra giao dịch trước khi mua
              lại.
            </FormNotice>
          )}
        </View>
      )}
      <MaterialPurchaseDialog
        material={purchaseIntent}
        busy={command.pending}
        disabled={locked || confirmationStale || !purchaseIntent}
        stale={confirmationStale}
        onClose={() => {
          if (!command.pending && !confirming.current)
            setPurchaseIntent(undefined);
        }}
        onConfirm={() => {
          if (
            confirming.current ||
            locked ||
            confirmationStale ||
            !purchaseIntent ||
            !runtime.isCurrent()
          )
            return;
          confirming.current = true;
          setRefundedReceipt(false);
          void command
            .buy(purchaseIntent)
            .then(complete)
            .finally(() => {
              confirming.current = false;
              if (runtime.isCurrent()) setPurchaseIntent(undefined);
            });
        }}
      />
    </FeaturePage>
  );
}
