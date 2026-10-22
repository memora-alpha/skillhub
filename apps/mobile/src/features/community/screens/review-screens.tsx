import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ChoiceGroup } from "@/components/choice-group";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnections,
  useParticipantName,
} from "@/features/connections";
import { useLearningPath, useLearningPaths } from "@/features/learning-paths";
import { uuid } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import { useReviewSubmission } from "../hooks/use-review-submission";
import { reviewInput, type Review } from "../api/community-api";

export function ReviewsScreen() {
  const query = useLearningPaths();
  const items = query.data?.filter((path) => path.status === "COMPLETED") ?? [];
  return (
    <FeaturePage title="Đánh giá" back="/profile" demo={false}>
      <Copy>
        Chọn lộ trình đã hoàn tất để xem đánh giá của hai bên hoặc chia sẻ trải
        nghiệm.
      </Copy>
      <Button
        variant="paper"
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
      >
        Làm mới lộ trình
      </Button>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {query.denied && (
        <Copy>Bạn hiện không có quyền xem danh sách lộ trình.</Copy>
      )}
      {query.data && !items.length && (
        <EmptyState
          title="Chưa có lộ trình để đánh giá"
          description="Đánh giá mở sau khi lộ trình hoàn tất và được quyết toán."
        />
      )}
      {items.map((path) => (
        <ReviewPathCard
          key={path.id}
          id={path.id}
          counterpartId={path.counterpartId}
        />
      ))}
      {query.data?.length === 100 && (
        <Copy muted>
          Danh sách hiện dựa trên 100 lộ trình cập nhật gần nhất.
        </Copy>
      )}
    </FeaturePage>
  );
}
function ReviewPathCard({
  id,
  counterpartId,
}: Readonly<{ id: string; counterpartId: string }>) {
  const name = useParticipantName(counterpartId);
  return (
    <Panel title={`Lộ trình cùng ${name.data ?? "người trao đổi"}`}>
      <RouteButton href={`/paths/${id}/review`}>
        Xem / viết đánh giá
      </RouteButton>
    </Panel>
  );
}
export function ReviewEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const runtime = useConnections();
  const path = useLearningPath(id ?? "");
  const counterpartId =
    path.data?.participantAId === runtime.userId
      ? path.data?.participantBId
      : path.data?.participantAId;
  return (
    <FeaturePage title="Đánh giá lộ trình" back="/reviews" demo={false}>
      {!uuid.safeParse(id).success ? (
        <EmptyState
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
            <Copy>
              Lộ trình không còn khả dụng hoặc bạn không có quyền xem.
            </Copy>
          )}
          {path.data && counterpartId && (
            <PathReviews
              key={`${runtime.key.join(":")}:${id}`}
              id={path.data.id}
              counterpartId={counterpartId}
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
  eligible,
  blocked,
}: Readonly<{
  id: string;
  counterpartId: string;
  eligible: boolean;
  blocked: boolean;
}>) {
  const runtime = useConnections();
  const name = useParticipantName(counterpartId);
  const submit = useReviewSubmission(id, counterpartId);
  const { reviews, own } = submit;
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [validation, setValidation] = useState<string>();
  const input = reviewInput.safeParse({ rating: Number(rating), comment });
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
      <Panel title={`Trải nghiệm cùng ${name.data ?? "người trao đổi"}`}>
        <Button
          variant="paper"
          disabled={reviews.isFetching || busy}
          onPress={() => void submit.refresh()}
        >
          Làm mới đánh giá
        </Button>
        <ConnectionFeedback loading={reviews.isLoading} error={reviews.error} />
        {reviews.denied && (
          <Copy>Bạn hiện không có quyền xem đánh giá của lộ trình này.</Copy>
        )}
        {reviews.data?.map((row) => (
          <ReviewContent
            key={row.id}
            review={row}
            own={row.reviewerId === runtime.userId}
          />
        ))}
        {reviews.data?.length === 0 && (
          <Copy>Chưa có đánh giá được hiển thị.</Copy>
        )}
      </Panel>
      {submitted ? (
        <FormNotice tone="success">
          Bạn đã gửi đánh giá cho lộ trình này.
        </FormNotice>
      ) : !eligible ? (
        <FormNotice tone="info">
          Đánh giá sẽ mở sau khi toàn bộ lộ trình hoàn tất và được quyết toán.
        </FormNotice>
      ) : (
        <Panel title="Đánh giá của bạn">
          <ChoiceGroup
            label="Số sao"
            options={["1", "2", "3", "4", "5"]}
            value={rating}
            onChange={(value) => {
              if (!busy) setRating(value);
            }}
          />
          <Input
            label="Chia sẻ trải nghiệm (không bắt buộc)"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
            editable={!busy}
          />
          {validation && <FormNotice tone="error">{validation}</FormNotice>}
          {code === "REVIEW_NOT_OPEN" ? (
            <FormNotice tone="info">
              Lộ trình chưa đủ điều kiện đánh giá. Hãy mở lại lộ trình để cập
              nhật.
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
            disabled={disabled || busy || submit.state === "check"}
            onPress={() => {
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
          <Copy muted>
            Mỗi người đánh giá đối phương một lần trên mỗi lộ trình.
          </Copy>
        </Panel>
      )}
    </>
  );
}
function ReviewContent({
  review,
  own,
}: Readonly<{ review: Review; own: boolean }>) {
  return (
    <Panel title={own ? "Bạn đã đánh giá" : "Đánh giá nhận được"}>
      <Copy>{review.rating}/5 sao</Copy>
      {!!review.comment && <Copy>{review.comment}</Copy>}
      <Copy muted>{new Date(review.createdAt).toLocaleString("vi-VN")}</Copy>
    </Panel>
  );
}
