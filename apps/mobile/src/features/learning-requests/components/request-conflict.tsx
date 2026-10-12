import { View } from "react-native";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { uiLabel } from "@/constants/ui-copy";
import type { OwnerRequest } from "../types";
import { compareRequestDraft } from "../utils/request-recovery";
import {
  editableRequest,
  requestError,
  statusLabels,
  requestState,
} from "../utils/request-policy";
import type { ReadDenial } from "../utils/request-read";
import { RequestSection } from "./request-section";
import { RequestReadDenied } from "./request-state";
import { useSkillName } from "../hooks/use-requests";

export function RequestConflict({
  initial,
  latest,
  mode,
  denied,
  error,
  pending,
  load,
  keep,
  discard,
  leave,
}: {
  initial?: OwnerRequest;
  latest?: OwnerRequest;
  mode?: string;
  denied?: ReadDenial;
  error?: unknown;
  pending: boolean;
  load: () => void;
  keep: () => void;
  discard: () => void;
  leave: () => void;
}) {
  const oldSkill = useSkillName(initial?.skillId);
  const newSkill = useSkillName(latest?.skillId);
  if (denied)
    return <RequestReadDenied denial={denied} retry={load} pending={pending} />;
  if (!mode && !error) return null;
  if (!initial)
    return (
      <RequestSection title="Kiểm tra kết quả lưu">
        <Copy>
          Chưa xác nhận được yêu cầu đã được tạo. Nội dung nhập vẫn được giữ;
          hãy kiểm tra danh sách trước khi tạo lại.
        </Copy>
        <Button variant="paper" disabled={pending} onPress={leave}>
          Mở yêu cầu của tôi
        </Button>
      </RequestSection>
    );
  return (
    <RequestSection
      title={latest ? "Đối chiếu bản mới" : "Giữ chỉnh sửa của bạn"}
    >
      <Copy>
        Nội dung chưa lưu vẫn được giữ trong phiên này. Đọc bản mới để kiểm tra
        trước khi tiếp tục.
      </Copy>
      {!!error && <FormNotice tone="error">{requestError(error)}</FormNotice>}
      {latest && (
        <>
          <Copy>Trạng thái hiện tại: {statusLabels[requestState(latest)]}</Copy>
          {compareRequestDraft(initial, latest).map((item) => (
            <View key={item.field} style={{ gap: 6 }}>
              <Copy>{item.label}</Copy>
              <Copy muted>
                Bản đã mở:{" "}
                {item.field === "skillId"
                  ? (oldSkill.data?.name ?? "Kỹ năng trước đó")
                  : item.field === "currentLevel"
                    ? uiLabel(item.before)
                    : item.before || "Để trống"}
              </Copy>
              <Copy>
                Bản mới:{" "}
                {item.field === "skillId"
                  ? (newSkill.data?.name ?? "Kỹ năng đã thay đổi")
                  : item.field === "currentLevel"
                    ? uiLabel(item.after)
                    : item.after || "Để trống"}
              </Copy>
            </View>
          ))}
          {compareRequestDraft(initial, latest).length === 0 && (
            <Copy muted>Các field trong form không đổi trên bản mới.</Copy>
          )}
          {latest.publishedAt && (
            <Copy muted>Kỹ năng đã khóa sau lần đăng đầu tiên.</Copy>
          )}
          {editableRequest(latest) ? (
            <>
              <Copy muted>
                Tiếp tục sẽ giữ các field bạn đã sửa và nhận giá trị mới cho
                field chưa chỉnh. Bạn cần nhấn Lưu để gửi thay đổi.
              </Copy>
              <Button variant="paper" disabled={pending} onPress={keep}>
                Giữ chỉnh sửa, dùng bản mới
              </Button>
              <Button variant="ghost" disabled={pending} onPress={discard}>
                Bỏ chỉnh sửa, dùng bản mới
              </Button>
            </>
          ) : (
            <>
              <FormNotice tone="info">
                Yêu cầu hiện không cho phép sửa. Nội dung của bạn vẫn được giữ
                để đối chiếu.
              </FormNotice>
              <Button variant="paper" disabled={pending} onPress={leave}>
                Trở về chi tiết yêu cầu
              </Button>
            </>
          )}
        </>
      )}
      <Button variant="paper" disabled={pending} onPress={load}>
        {pending ? "Đang đọc bản mới..." : "Đọc bản mới từ máy chủ"}
      </Button>
    </RequestSection>
  );
}
