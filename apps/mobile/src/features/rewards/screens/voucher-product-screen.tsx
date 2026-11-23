import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { InfoModal } from "@/components/InfoModal";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import type { RewardProduct } from "../api/reward-contracts";
import { useRewards } from "../context/rewards-provider";
import { useRewardProduct } from "../hooks/use-rewards";
import { RewardLogo } from "../components/reward-card";
import { RedemptionRecovery } from "../components/redemption-recovery";
import { VoucherRedeemFooter } from "../components/voucher-redeem-footer";
import { creditLabel, vndLabel } from "../utils/reward-presentation";
import { rewardStyles as s } from "../components/reward.styles";

export function VoucherProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useConnections();
  return (
    <ProductContent
      key={JSON.stringify([runtime.key, id])}
      id={typeof id === "string" ? id : ""}
    />
  );
}
function ProductContent({ id }: Readonly<{ id: string }>) {
  const query = useRewardProduct(id);
  const { state, model } = useRewards();
  const runtime = useConnections();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<RewardProduct>();
  const confirming = useRef(false);
  const active = useRef(false);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const product = query.data;
  const stale =
    !!confirmation &&
    (!product ||
      confirmation.priceVersion !== product.priceVersion ||
      confirmation.priceCredit !== product.priceCredit ||
      confirmation.name !== product.name);
  const locked =
    state.stage !== "ready" || query.isFetching || !!query.error || !product;
  const confirm = () => {
    if (
      confirming.current ||
      locked ||
      stale ||
      !confirmation ||
      !runtime.isCurrent()
    )
      return;
    confirming.current = true;
    void model
      .redeem(confirmation)
      .then((row) => {
        if (row && active.current && runtime.isCurrent())
          router.replace(`/vouchers/mine/${row.id}`);
      })
      .finally(() => {
        confirming.current = false;
        if (runtime.isCurrent()) setConfirmation(undefined);
      });
  };
  return (
    <FeaturePage
      title="Chi tiết voucher"
      back="/vouchers"
      backBehavior="history"
      onRefresh={() => {
        void query.refetch();
      }}
      refreshing={query.isRefetching}
      stickyFooter={
        product && (
          <VoucherRedeemFooter
            product={product}
            state={state}
            disabled={locked}
            onRedeem={() => setConfirmation(product)}
            onReload={() => {
              void query.refetch();
            }}
            onRecoverStorage={() => {
              void model.load();
            }}
            recovery={
              state.stage !== "pending" && (
                <RedemptionRecovery showUnavailable />
              )
            }
          />
        )
      }
    >
      {!uuid.safeParse(id).success && (
        <FormNotice tone="error">Đường dẫn voucher không hợp lệ.</FormNotice>
      )}
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={() => query.refetch()}
      />
      {product && <VoucherProductOverview product={product} />}
      <InfoModal
        titleStyle={s.heading}
        title={confirmation ? "Xác nhận đổi voucher?" : null}
        busy={state.stage === "pending"}
        onClose={() => {
          if (state.stage !== "pending" && !confirming.current)
            setConfirmation(undefined);
        }}
        showConfirm={false}
        footer={
          <View style={s.dialogActions}>
            <Button
              variant="paper"
              style={s.grow}
              disabled={state.stage === "pending"}
              onPress={() => setConfirmation(undefined)}
            >
              Để sau
            </Button>
            <Button
              variant="craft"
              style={s.grow}
              disabled={locked || stale || !confirmation}
              onPress={confirm}
            >
              Xác nhận đổi
            </Button>
          </View>
        }
      >
        {confirmation && (
          <View style={s.stack}>
            <Text style={s.heading}>{confirmation.name}</Text>
            <Text style={s.price}>{creditLabel(confirmation.priceCredit)}</Text>
            <Text style={s.body}>
              Credit khả dụng sẽ được trừ khi yêu cầu được tiếp nhận.
            </Text>
            {stale && (
              <FormNotice tone="warning">
                Thông tin đã thay đổi. Đóng để kiểm tra giá mới.
              </FormNotice>
            )}
          </View>
        )}
      </InfoModal>
    </FeaturePage>
  );
}
function VoucherProductOverview({
  product,
}: Readonly<{ product: RewardProduct }>) {
  return (
    <>
      <View style={s.detailHero}>
        <View style={s.row}>
          <RewardLogo name={product.brand.name} uri={product.brand.logoUrl} />
          <View style={s.grow}>
            <Text style={s.heading}>{product.brand.name}</Text>
            {!!product.category && (
              <Text style={s.muted}>{product.category}</Text>
            )}
          </View>
        </View>
        <Text style={s.detailAmount}>{vndLabel(product.faceValueVnd)}</Text>
        <Text style={s.title}>{product.name}</Text>
      </View>
      <Panel title="Điều kiện sử dụng">
        <Copy>
          {product.terms ||
            "Chưa có điều kiện sử dụng chi tiết từ nhà cung cấp."}
        </Copy>
        <Copy muted>
          {product.validityDays
            ? `Có hiệu lực ${product.validityDays} ngày kể từ khi phát hành.`
            : "Hạn sử dụng sẽ hiển thị trên voucher sau khi được phát hành."}
        </Copy>
      </Panel>
    </>
  );
}
