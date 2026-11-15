import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useMaterialReviewEligibility } from "../hooks/use-material-reviews";
import { usePublicMaterial } from "../hooks/use-materials";
import { MaterialReviewEditor } from "../components/material-review-editor";
import { MaterialCover } from "../components/material-cover";
import { materialStyles as styles } from "../components/material.styles";

const reasons: Record<string, string> = {
  MATERIAL_OWNER_CANNOT_REVIEW: "Bạn không thể đánh giá tài liệu do mình đăng.",
  MATERIAL_ACCESS_REQUIRED:
    "Bạn cần tải tài liệu miễn phí trước khi viết đánh giá.",
  MATERIAL_PURCHASE_REQUIRED: "Bạn cần mua tài liệu trước khi viết đánh giá.",
  MATERIAL_ENTITLEMENT_REVOKED:
    "Quyền truy cập của bạn không còn hiệu lực để viết đánh giá.",
  MATERIAL_NOT_PUBLISHED: "Tài liệu hiện không nhận đánh giá.",
};
export function MaterialReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const runtime = useConnections();
  return (
    <ReviewContent key={JSON.stringify([runtime.key, id])} id={id ?? ""} />
  );
}
function ReviewContent({ id }: Readonly<{ id: string }>) {
  const runtime = useConnections();
  const router = useRouter();
  const query = useMaterialReviewEligibility(id);
  const metadata = usePublicMaterial(id);
  const [epoch, setEpoch] = useState(0);
  const current = query.data?.currentReview;
  const refresh = async (preserveMissing = false) => {
    const result = await query.refetch();
    if (!runtime.isCurrent() || result.error || !result.data) return;
    if (!preserveMissing || result.data.currentReview)
      setEpoch((value) => value + 1);
  };
  if (query.data && (query.data.canReview || current))
    return (
      <MaterialReviewEditor
        key={JSON.stringify([runtime.key, id, current?.id, epoch])}
        materialId={id}
        current={current ?? null}
        ready={
          runtime.enabled && !query.error && !query.isFetching && !query.denied
        }
        reconcile={refresh}
        refreshing={query.isFetching}
        onRefresh={() => {
          void query.refetch();
        }}
        onDone={() => router.dismissTo("/materials/mine?tab=library")}
        context={
          <>
            <ConnectionFeedback error={query.error} retry={query.refetch} />
            <View style={[styles.fileRow, { marginBottom: 12 }]}>
              {metadata.data && <MaterialCover material={metadata.data} />}
              <View style={styles.grow}>
                <Text style={styles.title}>
                  {metadata.data?.title ?? "Tài liệu trong thư viện"}
                </Text>
                <Text style={styles.meta}>
                  Chia sẻ trải nghiệm sử dụng của bạn
                </Text>
              </View>
            </View>
          </>
        }
      />
    );
  return (
    <FeaturePage
      title="Đánh giá tài liệu"
      back="/materials/mine?tab=library"
      backBehavior="history"
      refreshing={query.isFetching}
      onRefresh={() => {
        if (uuid.safeParse(id).success) void query.refetch();
      }}
    >
      {!uuid.safeParse(id).success ? (
        <EmptyState
          icon="book"
          title="Tài liệu không hợp lệ"
          titleStyle={styles.heading}
          description="Mở tài liệu từ thư viện của bạn để viết đánh giá."
        />
      ) : (
        <>
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={query.refetch}
          />
          {query.data && !query.data.canReview && (
            <FormNotice tone="info">
              {reasons[query.data.reasonCode ?? ""] ??
                "Bạn hiện chưa thể viết đánh giá tài liệu này."}
            </FormNotice>
          )}
          {query.denied && (
            <FormNotice tone="info">
              Đánh giá tài liệu hiện không khả dụng với tài khoản của bạn.
            </FormNotice>
          )}
        </>
      )}
    </FeaturePage>
  );
}
