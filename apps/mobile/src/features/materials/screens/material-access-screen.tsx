import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import {
  useMaterialOwnership,
  usePublicMaterial,
} from "../hooks/use-materials";
import { useMaterialDownload } from "../hooks/use-material-download";
import { MaterialDownloadFeedback } from "../components/material-download-feedback";
import { MaterialFileBadge } from "../components/material-summary";
import { materialStyles as styles } from "../components/material.styles";

export function MaterialAccessScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const runtime = useConnections();
  return <AccessContent key={JSON.stringify([runtime.key, id])} id={id} />;
}
function AccessContent({ id }: Readonly<{ id: string }>) {
  const router = useRouter();
  const runtime = useConnections();
  const cache = useQueryClient();
  const download = useMaterialDownload(id, () => {
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "free-library"],
    });
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "orders"],
    });
  });
  const preview = usePublicMaterial(id);
  const ownership = useMaterialOwnership(id);
  const needsPurchase =
    ownership.data === null &&
    preview.data?.accessType === "PAID" &&
    preview.data.ownerId !== runtime.userId;
  return (
    <FeaturePage
      title="Tải tài liệu"
      compact
      back="/materials/library"
      backBehavior="history"
    >
      <View style={styles.formSection}>
        <View style={styles.inline}>
          <MaterialFileBadge
            material={ownership.data ? undefined : preview.data}
            large
          />
          <View style={styles.grow}>
            <Text style={styles.heading}>
              {ownership.data?.purchasedMaterial
                ? (ownership.data.purchasedMaterial.title ??
                  ownership.data.purchasedMaterial.originalFilename ??
                  "Tài liệu đã mua")
                : (preview.data?.title ?? "Tệp tài liệu")}
            </Text>
            {ownership.data && (
              <Text style={styles.meta}>
                Phiên bản đã mua: {ownership.data.listingVersion}
              </Text>
            )}
            {!!ownership.data?.purchasedMaterial?.originalFilename && (
              <Text style={styles.meta}>
                {ownership.data.purchasedMaterial.originalFilename}
              </Text>
            )}
          </View>
        </View>
        <ConnectionFeedback
          loading={ownership.isLoading}
          error={ownership.error}
          retry={ownership.refetch}
        />
        <MaterialDownloadFeedback download={download} />
        <Button
          variant="craft"
          leadingIcon={needsPurchase ? "wallet" : "download"}
          disabled={
            download.pending ||
            download.awaitingConfirmation ||
            ownership.isLoading ||
            ownership.isFetching ||
            !!ownership.error ||
            ownership.data === undefined ||
            !uuid.safeParse(id).success
          }
          onPress={() => {
            if (needsPurchase) router.replace(`/materials/${id}/purchase`);
            else void download.start(!!ownership.data);
          }}
        >
          {download.pending
            ? "Đang tải…"
            : needsPurchase
              ? "Mua tài liệu"
              : "Tải tài liệu"}
        </Button>
      </View>
    </FeaturePage>
  );
}
