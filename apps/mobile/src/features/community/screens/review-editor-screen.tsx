import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
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
import { useLearningPath } from "@/features/learning-paths";
import { uuid } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import { useReviewSubmission } from "../hooks/use-review-submission";
import { reviewInput } from "../api/community-api";
import { ReviewRatingPicker } from "../components/review-stars";
import { ReviewCard } from "../components/review-card";
import { reviewStyles as styles } from "../components/review.styles";
import { teacherReviewPlan } from "../utils/teacher-review";

export function ReviewEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const runtime = useConnections();
  const path = useLearningPath(id ?? "");
  const counterpartId =
    path.data?.participantAId === runtime.userId
      ? path.data?.participantBId
      : path.data?.participantAId;
  const plan = path.data
    ? teacherReviewPlan(path.data, runtime.userId)
    : undefined;
  return (
    <FeaturePage
      title="Đánh giá lộ trình"
      back={{ pathname: "/reviews", params: { tab: "write" } }}
    >
      {!uuid.safeParse(id).success ? (
        <EmptyState
          icon="book"
          title="Lộ trình không hợp lệ"
          description="Chọn một lộ trình từ danh sách đánh giá."
          titleStyle={styles.sectionTitle}
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
          {path.data && counterpartId && (
            <PathReviews
              key={`${runtime.key.join(":")}:${id}`}
              id={path.data.id}
              counterpartId={counterpartId}
              skillId={plan?.skillId}
              canReviewTeacher={!!plan}
              eligible={
                path.data.status === "COMPLETED" && path.data.settledAt !== null
              }
              blocked={!!path.error}
            />
          )}
        </>
      )}
    </FeaturePage>
  );
}

function PathReviews({
  id,
  counterpartId,
  skillId,
  canReviewTeacher,
  eligible,
  blocked,
}: Readonly<{
  id: string;
  counterpartId: string;
  skillId?: string;
  canReviewTeacher: boolean;
  eligible: boolean;
  blocked: boolean;
}>) {
  const runtime = useConnections();
  const profile = useParticipantProfile(counterpartId);
  const skill = useCatalogName(skillId);
  const name = profile.data?.fullName ?? "Người trao đổi";
  const submit = useReviewSubmission(id, counterpartId);
  const { reviews, own } = submit;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [validation, setValidation] = useState<string>();
  const busy = submit.state === "sending";
  const submitted = !!own || submit.state === "submitted";
  const disabled =
    blocked ||
    reviews.isFetching ||
    !!reviews.error ||
    !reviews.data ||
    reviews.denied;
  const code = submit.error instanceof AppError ? submit.error.code : "";
  return (
    <>
      <View style={styles.partner}>
        <Avatar
          name={name}
          userId={counterpartId}
          sourceUri={profile.data?.avatarUrl}
          size={48}
        />
        <View style={styles.grow}>
          <Text style={styles.meta}>
            {canReviewTeacher ? "Người dạy của bạn" : "Người học"}
          </Text>
          <Text style={styles.cardTitle}>{name}</Text>
          {skill.data && <Text style={styles.meta}>{skill.data}</Text>}
        </View>
      </View>
      <ConnectionFeedback loading={reviews.isLoading} error={reviews.error} />
      {reviews.denied && (
        <FormNotice tone="info">
          Bạn hiện không có quyền xem đánh giá của lộ trình này.
        </FormNotice>
      )}
      {submitted ? (
        <View style={styles.success} accessibilityLiveRegion="polite">
          <View style={styles.partner}>
            <Icon name="check-circle" size={24} color={colors.forest} />
            <Text style={styles.successTitle}>Đã gửi đánh giá</Text>
          </View>
        </View>
      ) : !canReviewTeacher ? null : !eligible ? (
        <FormNotice tone="info">
          Đánh giá sẽ mở sau khi toàn bộ lộ trình hoàn tất và được quyết toán.
        </FormNotice>
      ) : (
        <View style={styles.form}>
          <ReviewRatingPicker
            value={rating}
            disabled={busy || disabled || submit.state === "check"}
            onChange={(value) => {
              setRating(value);
              setValidation(undefined);
            }}
          />
          <View style={styles.stack}>
            <Input
              label="Chia sẻ trải nghiệm (không bắt buộc)"
              placeholder="Điều gì hữu ích? Bạn mong muốn cải thiện điều gì?"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
              editable={!busy}
              style={styles.input}
              fieldStyle={styles.inputField}
            />
            <Text style={styles.characterCount}>
              {comment.length.toLocaleString("vi-VN")} / 1.000 ký tự
            </Text>
          </View>
          {validation && <FormNotice tone="error">{validation}</FormNotice>}
          {code === "REVIEW_NOT_OPEN" ? (
            <FormNotice tone="info">
              Lộ trình chưa đủ điều kiện đánh giá. Hãy tải lại lộ trình.
            </FormNotice>
          ) : (
            <ConnectionFeedback error={submit.error} />
          )}
          {submit.state === "check" && (
            <FormNotice tone="info">
              Chưa rõ kết quả gửi. Chọn “Làm mới đánh giá” để kiểm tra trước khi
              gửi tiếp.
            </FormNotice>
          )}
          <Button
            variant="craft"
            leadingIcon="send"
            accessibilityState={{ busy }}
            disabled={disabled || busy || submit.state === "check"}
            onPress={() => {
              const input = reviewInput.safeParse({ rating, comment });
              if (!input.success)
                return setValidation(
                  "Chọn từ 1 đến 5 sao; nhận xét tối đa 1.000 ký tự.",
                );
              setValidation(undefined);
              void submit.send(input.data);
            }}
          >
            {busy ? "Đang gửi…" : "Gửi đánh giá"}
          </Button>
        </View>
      )}
      <View style={styles.stack}>
        <View style={styles.row}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Đánh giá trong lộ trình
          </Text>
          <Button
            variant="paper"
            size="sm"
            leadingIcon="refresh"
            disabled={reviews.isFetching || busy}
            accessibilityLabel="Làm mới đánh giá"
            onPress={() => void submit.refresh()}
          >
            Làm mới
          </Button>
        </View>
        {reviews.data?.map((row) => (
          <ReviewCard
            key={row.id}
            name={row.reviewerId === runtime.userId ? "Bạn" : name}
            userId={row.reviewerId}
            own={row.reviewerId === runtime.userId}
            rating={row.rating}
            comment={row.comment}
            createdAt={row.createdAt}
          />
        ))}
        {reviews.data?.length === 0 && !reviews.error && !reviews.denied && (
          <Text style={styles.meta}>Chưa có đánh giá.</Text>
        )}
      </View>
    </>
  );
}
