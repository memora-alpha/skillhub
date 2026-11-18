import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { InfoModal } from "@/components/InfoModal";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { reviewStyles as styles } from "./material-review.styles";
import { useConnectionCommand } from "@/features/connections";
import { useMaterialsApi } from "../hooks/use-materials";
import { materialFailure } from "../utils/material-failure";

export function MaterialReviewReport({
  reviewId,
  ready,
}: Readonly<{ reviewId: string; ready: boolean }>) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);
  const command = useConnectionCommand([["materials", "reviews"]]);
  const api = useMaterialsApi();
  const invalid =
    description.trim().length < 10 || description.trim().length > 2000;
  const disabled = command.pending || command.uncertain || !ready || invalid;
  const send = async () => {
    if (disabled) return;
    const result = await command.run(
      JSON.stringify([reviewId, description.trim()]),
      () => api.reportReview(reviewId, description),
    );
    if (result) {
      setSent(true);
      setOpen(false);
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        style={styles.iconAction}
        accessibilityLabel={sent ? "Đã báo cáo đánh giá" : "Báo cáo đánh giá"}
        disabled={sent || !ready || command.pending}
        onPress={() => setOpen(true)}
      >
        <Icon
          name={sent ? "check" : "flag"}
          size={16}
          color={sent ? appColors.success : appColors.mutedLight}
        />
      </Button>
      <InfoModal
        title={open ? "Báo cáo đánh giá" : null}
        titleStyle={styles.heading}
        onClose={() => setOpen(false)}
        busy={command.pending}
        showConfirm={false}
        footer={
          <Button
            variant="craft"
            disabled={disabled}
            onPress={() => void send()}
          >
            Gửi báo cáo
          </Button>
        }
      >
        <Input
          label="Lý do báo cáo"
          multiline
          value={description}
          onChangeText={setDescription}
          editable={!command.pending && !command.uncertain}
          hint="Mô tả từ 10 đến 2.000 ký tự."
        />
        {!!command.error && (
          <FormNotice tone={command.uncertain ? "warning" : "error"} compact>
            {command.uncertain
              ? "Chưa xác nhận được báo cáo đã gửi. Không gửi lại để tránh trùng; bạn có thể đóng hộp thoại."
              : materialFailure(command.error)}
          </FormNotice>
        )}
      </InfoModal>
    </>
  );
}
