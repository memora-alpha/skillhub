import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useCatalogName } from "@/features/connections";
import type { useMaterialEditor } from "../hooks/use-material-editor";
import {
  canEditMaterial,
  materialEditHint,
  materialPrice,
} from "../utils/owner-material-presentation";
import { materialFailure } from "../utils/material-failure";
import { materialStyles as styles } from "./material.styles";

type Editor = ReturnType<typeof useMaterialEditor>;
export function MaterialEditorConflict({
  recovery,
  resolveConflict,
  busy,
}: Readonly<{
  recovery: Editor["recovery"];
  resolveConflict: Editor["resolveConflict"];
  busy: boolean;
}>) {
  const latest = recovery.latest;
  const skill = useCatalogName(latest?.skillId);
  if (!recovery.conflict) return null;
  return (
    <View style={styles.section}>
      <FormNotice tone="warning" compact>
        Phiên bản tài liệu trên máy chủ đã thay đổi. Nội dung bạn đang sửa vẫn
        được giữ. Tải bản mới để đối chiếu trước khi lưu lại.
      </FormNotice>
      <Button
        variant="paper"
        disabled={recovery.loading || busy}
        onPress={() => void recovery.reload()}
      >
        {recovery.loading ? "Đang tải bản mới…" : "Tải bản mới để đối chiếu"}
      </Button>
      {!!recovery.error && (
        <FormNotice tone="error" compact>
          {materialFailure(recovery.error)}
        </FormNotice>
      )}
      {latest && (
        <View style={styles.catalogCard}>
          <Text style={styles.sectionTitle}>Bản mới trên máy chủ</Text>
          <Text selectable style={styles.title}>
            {latest.title}
          </Text>
          <Text selectable style={styles.body}>
            {latest.description}
          </Text>
          <Text style={styles.meta}>
            Kỹ năng:{" "}
            {skill.data ??
              (skill.error
                ? "Chưa đọc được tên kỹ năng"
                : "Đang đọc tên kỹ năng…")}
          </Text>
          <Text style={styles.meta}>
            {latest.accessType === "FREE"
              ? "Miễn phí"
              : `Trả phí · ${materialPrice(latest)}`}
          </Text>
          <Text selectable style={styles.meta}>
            Tệp: {latest.file?.originalFilename ?? "Chưa đính kèm tệp"}
          </Text>
          {canEditMaterial(latest) ? (
            <>
              <Text style={styles.caption}>
                Chọn nội dung muốn tiếp tục, kiểm tra lại rồi bấm lưu. Tệp mới
                bạn đã chọn cũng được giữ khi giữ nội dung đang sửa; nếu chưa
                chọn tệp mới, dùng tệp trên máy chủ.
              </Text>
              <Button
                variant="paper"
                disabled={busy}
                onPress={() => resolveConflict(true)}
              >
                Giữ nội dung đang sửa
              </Button>
              <Button
                variant="paper"
                disabled={busy}
                onPress={() => resolveConflict(false)}
              >
                Dùng bản mới, bỏ thay đổi đang sửa
              </Button>
            </>
          ) : (
            <FormNotice tone="info" compact>
              {materialEditHint(latest)} Bạn vẫn có thể xem và sao chép nội dung
              đang sửa phía trên.
            </FormNotice>
          )}
        </View>
      )}
    </View>
  );
}
