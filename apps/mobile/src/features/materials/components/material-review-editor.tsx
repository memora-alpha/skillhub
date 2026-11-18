import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormNotice } from "@/components/FormNotice";
import { InfoModal } from "@/components/InfoModal";
import { Icon } from "@/components/Icon";
import { ReviewRatingPicker, ReviewStars } from "@/features/community";
import { appColors } from "@/constants/theme";
import { useConnectionCommand } from "@/features/connections";
import type { OwnMaterialReview } from "../api/material-reviews-api";
import { useMaterialsApi } from "../hooks/use-materials";
import { materialFailure } from "../utils/material-failure";
import { reviewStyles as styles } from "./material-review.styles";
import { FeaturePage } from "@/components/feature-page";

export function MaterialReviewEditor({
  materialId,
  current,
  ready,
  canEdit = true,
  reconcile,
  context,
  refreshing,
  onRefresh,
  onDone,
}: Readonly<{
  materialId: string;
  current: OwnMaterialReview | null;
  ready: boolean;
  canEdit?: boolean;
  reconcile: (preserveMissing?: boolean) => Promise<void>;
  context?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onDone: () => void;
}>) {
  const api = useMaterialsApi();
  const command = useConnectionCommand([["materials"]]);
  const [baseline, setBaseline] = useState(current);
  const [rating, setRating] = useState(current?.rating ?? 0);
  const [comment, setComment] = useState(current?.comment ?? "");
  const [editing, setEditing] = useState(!current);
  const [deleting, setDeleting] = useState(false);
  const displayed =
    current && baseline && current.version >= baseline.version
      ? current
      : baseline;
  const changed = current?.version !== baseline?.version;
  const busy = command.pending || command.uncertain || !ready || changed;
  const hidden = current?.status === "HIDDEN";
  const submit = async () => {
    if (
      busy ||
      hidden ||
      !canEdit ||
      rating < 1 ||
      [...comment.trim()].length > 2000
    )
      return;
    const body = { rating, comment: comment.trim() };
    const result = await command.run(
      JSON.stringify([materialId, current?.id, current?.version, body]),
      (key) =>
        current
          ? api.updateReview(materialId, current.id, current.version, body)
          : api.createReview(materialId, body, key),
    );
    if (result) {
      // A retained create key can replay a review deleted on another device.
      // That receipt resolves the old intent; reload instead of claiming it is visible.
      if (result.deletedAt) {
        await reconcile();
        return;
      }
      setBaseline(result);
      setEditing(false);
    }
  };
  const remove = async () => {
    if (busy || !current) return;
    const result = await command.run(
      JSON.stringify(["delete", current.id, current.version]),
      () => api.deleteReview(materialId, current.id, current.version),
    );
    if (result) {
      setDeleting(false);
      setBaseline(null);
      setEditing(false);
    }
  };
  const actions = (
    <View style={styles.formActions}>
      <Button
        variant="ghost"
        size="sm"
        disabled={command.pending || command.uncertain}
        onPress={() => {
          if (!displayed) onDone();
          else setEditing(false);
        }}
      >
        Hủy
      </Button>
      <Button
        variant="craft"
        style={styles.submit}
        disabled={
          busy || !canEdit || rating < 1 || [...comment.trim()].length > 2000
        }
        onPress={() => void submit()}
      >
        {command.pending
          ? "Đang lưu…"
          : current
            ? "Lưu đánh giá"
            : "Gửi đánh giá"}
      </Button>
    </View>
  );
  const content = (
    <View style={displayed ? styles.own : styles.editor}>
      {changed && ready && (
        <>
          <FormNotice tone="warning" compact>
            Đánh giá đã thay đổi. Đọc bản mới để tiếp tục.
          </FormNotice>
          <Button
            variant="paper"
            disabled={command.pending || !ready}
            onPress={() => void reconcile()}
          >
            Đọc bản đánh giá mới
          </Button>
        </>
      )}
      {hidden && (
        <FormNotice tone="info" compact>
          Đánh giá này đang bị ẩn.
        </FormNotice>
      )}
      {displayed && (!editing || hidden) && (
        <>
          <View style={styles.ownHeader}>
            <View style={styles.ownInfo}>
              <Text style={styles.name}>Đánh giá của bạn</Text>
              <ReviewStars rating={displayed.rating} size={14} />
            </View>
            <View style={styles.actions}>
              {!hidden && (
                <Button
                  variant="ghost"
                  size="sm"
                  style={styles.smallAction}
                  accessibilityLabel="Chỉnh sửa đánh giá"
                  disabled={busy || !canEdit}
                  onPress={() => setEditing(true)}
                >
                  Sửa
                </Button>
              )}
              <Button
                variant="ghost"
                style={styles.iconAction}
                accessibilityLabel="Xóa đánh giá"
                disabled={busy}
                onPress={() => setDeleting(true)}
              >
                <Icon name="trash" size={17} color={appColors.muted} />
              </Button>
            </View>
          </View>
          {!!displayed.comment && (
            <Text selectable style={styles.body}>
              {displayed.comment}
            </Text>
          )}
        </>
      )}
      {editing && !hidden && (
        <>
          <View style={styles.ratingPanel}>
            <ReviewRatingPicker
              value={rating}
              onChange={setRating}
              disabled={busy}
              compact
            />
          </View>
          <Input
            label="Nhận xét (không bắt buộc)"
            placeholder="Chia sẻ cảm nhận của bạn…"
            multiline
            value={comment}
            onChangeText={setComment}
            editable={!busy}
            error={
              [...comment.trim()].length > 2000
                ? "Nhập tối đa 2.000 ký tự."
                : undefined
            }
          />
          <Text style={styles.counter}>
            {[...comment.trim()].length.toLocaleString("vi-VN")} / 2.000
          </Text>
        </>
      )}
      {!!command.error && !command.uncertain && (
        <FormNotice tone="error" compact>
          {materialFailure(command.error)}
        </FormNotice>
      )}
      {command.uncertain && (
        <>
          <FormNotice tone="warning" compact>
            Chưa xác nhận được kết quả gửi.
          </FormNotice>
          <Button
            variant="paper"
            disabled={command.pending || !ready}
            onPress={() => {
              setDeleting(false);
              void reconcile(!current);
            }}
          >
            Kiểm tra lại đánh giá
          </Button>
          {!current && (
            <Button
              variant="paper"
              disabled={command.pending || !ready}
              onPress={() => void command.retry()}
            >
              Gửi lại cùng đánh giá
            </Button>
          )}
        </>
      )}
      <InfoModal
        title={deleting ? "Xóa đánh giá?" : null}
        titleStyle={styles.heading}
        onClose={() => setDeleting(false)}
        showConfirm={false}
        busy={command.pending}
        footer={
          <View style={styles.formActions}>
            <Button
              variant="paper"
              disabled={command.pending}
              onPress={() => setDeleting(false)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              leadingIcon="trash"
              disabled={busy}
              onPress={() => void remove()}
            >
              Xác nhận xóa
            </Button>
          </View>
        }
      >
        Bạn muốn xóa đánh giá này?
      </InfoModal>
    </View>
  );
  return (
    <FeaturePage
      title={
        editing
          ? current
            ? "Sửa đánh giá"
            : "Viết đánh giá"
          : "Đánh giá tài liệu"
      }
      back="/materials/mine?tab=library"
      backBehavior="history"
      keyboardDismissMode="on-drag"
      refreshing={refreshing}
      onRefresh={command.pending ? undefined : onRefresh}
      stickyFooter={
        <View style={styles.footer}>
          {editing && !hidden ? (
            actions
          ) : (
            <Button
              variant="paper"
              disabled={command.pending || command.uncertain}
              onPress={onDone}
            >
              Về thư viện
            </Button>
          )}
        </View>
      }
    >
      {context}
      {content}
    </FeaturePage>
  );
}
