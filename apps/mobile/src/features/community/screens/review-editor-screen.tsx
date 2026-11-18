import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { FeaturePage } from "@/components/feature-page";
import { appColors as colors } from "@/constants/theme";
import {
  ConnectionFeedback,
  useConnections,
  useParticipantProfile,
  useCatalogName,
} from "@/features/connections";
import {
  useLearningPath,
  type ApiLearningPath,
} from "@/features/learning-paths";
import { uuid } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import { useReviewSubmission } from "../hooks/use-review-submission";
import { reviewInput } from "../api/community-api";
import { ReviewRatingPicker, ReviewStars } from "../components/review-stars";
import { ReviewCard } from "../components/review-card";
import { reviewEditorStyles as styles } from "../components/review-editor.styles";
import { teacherReviewPlan } from "../utils/teacher-review";

const back = { pathname: "/reviews", params: { tab: "write" } } as const;
const ratingLabels = [
  "Chạm vào sao để đánh giá",
  "Chưa hài lòng",
  "Cần cải thiện",
  "Tạm ổn",
  "Hài lòng",
  "Rất hài lòng",
];

export function ReviewEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const runtime = useConnections();
  const path = useLearningPath(id ?? "");
  if (uuid.safeParse(id).success && path.data)
    return (
      <PathReviews
        key={`${runtime.key.join(":")}:${id}`}
        path={path.data}
        blocked={!!path.error || path.isFetching || path.denied}
        pathError={path.error}
        pathRefreshing={path.isFetching}
        refreshPath={path.refetch}
      />
    );
  return (
    <FeaturePage title="Đánh giá lộ trình" back={back} backBehavior="history">
      {!uuid.safeParse(id).success ? (
        <EmptyState
          icon="book"
          title="Lộ trình không hợp lệ"
          description="Chọn một lộ trình từ danh sách đánh giá."
        />
      ) : (
        <>
          <ConnectionFeedback
            loading={path.isLoading}
            error={path.error}
            retry={path.refetch}
          />
          {path.denied && (
            <FormNotice tone="info">
              Lộ trình không còn khả dụng hoặc bạn không có quyền xem.
            </FormNotice>
          )}
        </>
      )}
    </FeaturePage>
  );
}

function PathReviews({
  path,
  blocked,
  pathError,
  pathRefreshing,
  refreshPath,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  pathError: unknown;
  pathRefreshing: boolean;
  refreshPath: () => Promise<unknown>;
}>) {
  const runtime = useConnections();
  const router = useRouter();
  const counterpartId =
    path.participantAId === runtime.userId
      ? path.participantBId
      : path.participantAId;
  const plan = teacherReviewPlan(path, runtime.userId);
  const profile = useParticipantProfile(counterpartId);
  const skill = useCatalogName(
    plan?.skillId ??
      path.plans.find((row) => row.teacherId === runtime.userId)?.skillId,
  );
  const name = profile.data?.fullName ?? "Người trao đổi";
  const submit = useReviewSubmission(path.id, counterpartId);
  const { reviews, own } = submit;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [validation, setValidation] = useState<string>();
  const busy = submit.state === "sending";
  const checking = submit.state === "check";
  const submitted = !!own || submit.state === "submitted";
  const eligible = path.status === "COMPLETED" && path.settledAt !== null;
  const disabled =
    blocked ||
    reviews.isFetching ||
    !!reviews.error ||
    !reviews.data ||
    reviews.denied;
  const locked = busy || checking || disabled;
  const canWrite = !!plan && eligible && !submitted && !reviews.denied;
  const received =
    reviews.data?.filter((row) => row.reviewerId !== runtime.userId) ?? [];
  const code = submit.error instanceof AppError ? submit.error.code : "";
  const refresh = () => Promise.all([refreshPath(), submit.refresh()]);
  const send = () => {
    if (locked || !canWrite) return;
    const input = reviewInput.safeParse({ rating, comment });
    if (!input.success)
      return setValidation("Chọn từ 1 đến 5 sao; nhận xét tối đa 1.000 ký tự.");
    setValidation(undefined);
    void submit.send(input.data);
  };
  function renderFooter() {
    if (canWrite)
      return (
        <View style={styles.footer}>
          <Button
            variant="craft"
            size="lg"
            disabled={locked || rating === 0}
            accessibilityState={{ busy }}
            onPress={send}
          >
            {busy ? "Đang gửi…" : "Gửi đánh giá"}
          </Button>
          <Text style={styles.footerNote}>
            Bạn chỉ có thể gửi một đánh giá cho lộ trình này.
          </Text>
        </View>
      );
    if (submitted)
      return (
        <View style={styles.footer}>
          <Button
            variant="paper"
            size="lg"
            onPress={() => router.dismissTo(`/paths/${path.id}`)}
          >
            Về lộ trình
          </Button>
        </View>
      );
    return undefined;
  }
  function renderSubmittedReview() {
    return (
      <View style={styles.success} accessibilityLiveRegion="polite">
        <View style={styles.successHeading}>
          <Icon name="check-circle" size={22} color={colors.forest} />
          <Text style={styles.successTitle}>Đánh giá đã gửi</Text>
        </View>
        {own ? (
          <>
            <ReviewStars rating={own.rating} size={22} />
            {!!own.comment?.trim() && (
              <Text selectable style={styles.comment}>
                {own.comment}
              </Text>
            )}
            <Text style={styles.meta}>Cảm ơn bạn đã chia sẻ trải nghiệm.</Text>
          </>
        ) : (
          <>
            <Text style={styles.meta}>
              Bạn đã gửi đánh giá cho lộ trình này. Tải lại để xem nội dung còn
              hiển thị.
            </Text>
            <Button
              variant="paper"
              disabled={reviews.isFetching}
              onPress={() => void refresh()}
            >
              Tải lại đánh giá
            </Button>
          </>
        )}
      </View>
    );
  }
  function renderReviewForm() {
    return (
      <>
        <View style={styles.rating}>
          <Text accessibilityRole="header" style={styles.heading}>
            Trải nghiệm học của bạn thế nào?
          </Text>
          <ReviewRatingPicker
            compact
            value={rating}
            disabled={locked}
            onChange={(value) => {
              setRating(value);
              setValidation(undefined);
            }}
          />
          <Text accessibilityLiveRegion="polite" style={styles.ratingHint}>
            {ratingLabels[rating]}
          </Text>
        </View>
        <View style={styles.stack}>
          <View style={styles.commentHeading}>
            <Text style={styles.commentLabel}>Chia sẻ thêm</Text>
            <Text style={styles.meta}>(không bắt buộc)</Text>
          </View>
          <Input
            label="Nhận xét về người dạy"
            hideLabel
            placeholder="Cách hướng dẫn, nội dung học hay điều bạn muốn cải thiện…"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
            editable={!locked}
            style={styles.input}
            fieldStyle={styles.inputField}
          />
          <Text style={styles.characterCount}>
            {comment.length.toLocaleString("vi-VN")} / 1.000
          </Text>
        </View>
        {validation && <FormNotice tone="error">{validation}</FormNotice>}
        {code === "REVIEW_NOT_OPEN" ? (
          <FormNotice tone="info">
            Lộ trình chưa đủ điều kiện đánh giá. Tải lại để cập nhật trạng thái.
          </FormNotice>
        ) : (
          !checking && <ConnectionFeedback error={submit.error} />
        )}
        {checking && (
          <FormNotice tone="info">
            Chưa xác nhận được kết quả gửi. Kiểm tra đánh giá trước khi gửi lại;
            nội dung bạn nhập vẫn được giữ.
          </FormNotice>
        )}
        {(checking || code === "REVIEW_NOT_OPEN") && (
          <Button
            variant="paper"
            leadingIcon="refresh"
            disabled={busy || reviews.isFetching || pathRefreshing}
            accessibilityLabel="Làm mới đánh giá"
            onPress={() => void refresh()}
          >
            {checking ? "Kiểm tra đánh giá" : "Tải lại lộ trình"}
          </Button>
        )}
      </>
    );
  }
  function renderReviewState() {
    if (reviews.denied)
      return (
        <FormNotice tone="info">
          Bạn hiện không có quyền xem đánh giá của lộ trình này.
        </FormNotice>
      );
    if (submitted) return renderSubmittedReview();
    if (plan && !eligible)
      return (
        <FormNotice tone="info">
          Đánh giá sẽ mở sau khi toàn bộ lộ trình hoàn tất và được quyết toán.
        </FormNotice>
      );
    if (canWrite) return renderReviewForm();
    return null;
  }
  return (
    <FeaturePage
      title="Đánh giá lộ trình"
      back={back}
      backBehavior="history"
      keyboardDismissMode="on-drag"
      refreshing={pathRefreshing || reviews.isFetching}
      onRefresh={() => {
        if (!busy) void refresh();
      }}
      stickyFooter={renderFooter()}
    >
      <ConnectionFeedback error={pathError} retry={refresh} />
      <View style={styles.partner}>
        <Avatar
          name={name}
          userId={counterpartId}
          sourceUri={profile.data?.avatarUrl}
          size={52}
        />
        <View style={styles.identity}>
          <Text style={styles.eyebrow}>
            {plan ? "NGƯỜI DẠY CỦA BẠN" : "NGƯỜI HỌC"}
          </Text>
          <Text style={styles.name}>{name}</Text>
          {skill.data && <Text style={styles.meta}>{skill.data}</Text>}
        </View>
      </View>
      <ConnectionFeedback
        loading={reviews.isLoading}
        error={reviews.error}
        retry={refresh}
      />
      {renderReviewState()}
      {received.length > 0 && (
        <View>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Đánh giá từ {name}
          </Text>
          {received.map((row) => (
            <ReviewCard
              key={row.id}
              name={name}
              userId={row.reviewerId}
              rating={row.rating}
              comment={row.comment}
              createdAt={row.createdAt}
            />
          ))}
        </View>
      )}
      {!plan &&
        !submitted &&
        reviews.data?.length === 0 &&
        !reviews.error &&
        !reviews.denied && (
          <EmptyState
            icon="star"
            title="Chưa nhận được đánh giá"
            description="Đánh giá từ người học sẽ xuất hiện tại đây."
          />
        )}
    </FeaturePage>
  );
}
