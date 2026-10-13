import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { RequestSection } from "./request-section";
import {
  cancelableRequest,
  editableRequest,
  requestState,
  requestError,
} from "../utils/request-policy";
import type { OwnerRequest } from "../types";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

type RequestActionProps = {
  request: OwnerRequest;
  pending: boolean;
  blocked: boolean;
  run: (command: "edit" | "publish" | "cancel") => Promise<void>;
};

export function RequestDetailActions({
  request,
  pending,
  blocked,
  run,
}: RequestActionProps) {
  const [confirm, setConfirm] = useState(false);
  const disabled = pending || blocked;
  return (
    <>
      {cancelableRequest(request) && (
        <Button
          variant="ghost"
          style={{ minHeight: 44 }}
          disabled={disabled}
          onPress={() => setConfirm(true)}
        >
          <Icon name="close" size={15} color={colors.error} />
          <Text style={[styles.secondaryLabel, { color: colors.error }]}>
            Hủy yêu cầu
          </Text>
        </Button>
      )}
      {confirm && cancelableRequest(request) && (
        <RequestSection title="Hủy yêu cầu này?" compact>
          <Copy>
            Bài sẽ không nhận đề xuất mới. Lịch sử đề xuất được giữ lại.
          </Copy>
          <Button
            variant="craft"
            disabled={disabled}
            onPress={() => void run("cancel")}
          >
            {pending ? "Đang hủy..." : "Xác nhận hủy"}
          </Button>
          <Button
            variant="paper"
            disabled={pending}
            onPress={() => setConfirm(false)}
          >
            Giữ yêu cầu
          </Button>
        </RequestSection>
      )}
    </>
  );
}

export function RequestOwnerFooter({
  request,
  pending,
  blocked,
  run,
  error,
  refresh,
}: RequestActionProps & { error?: unknown; refresh: () => void }) {
  if (!editableRequest(request)) return null;
  const draft = requestState(request) === "DRAFT";
  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        {draft && !!error && (
          <RequestActionError
            error={error}
            pending={pending}
            refresh={refresh}
          />
        )}
        <View style={styles.footerRow}>
          <Button
            variant={draft ? "paper" : "craft"}
            style={
              draft
                ? [styles.secondary, styles.footerSecondary]
                : [styles.publish, styles.footerPrimary]
            }
            accessibilityLabel="Chỉnh sửa yêu cầu"
            disabled={pending || blocked}
            onPress={() => void run("edit")}
          >
            <Icon
              name="edit"
              size={15}
              color={draft ? colors.body : colors.white}
            />
            <Text style={draft ? styles.secondaryLabel : styles.publishLabel}>
              {draft ? "Chỉnh sửa" : "Chỉnh sửa yêu cầu"}
            </Text>
          </Button>
          {draft && (
            <Button
              variant="craft"
              style={[styles.publish, styles.footerPrimary]}
              accessibilityLabel="Đăng yêu cầu học"
              disabled={pending || blocked}
              onPress={() => void run("publish")}
            >
              <Icon name="send" size={17} color={colors.white} />
              <Text style={styles.publishLabel}>
                {pending ? "Đang xử lý..." : "Đăng yêu cầu"}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}

export function RequestActionError({
  error,
  pending,
  refresh,
}: {
  error: unknown;
  pending: boolean;
  refresh: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <FormNotice tone="error">{requestError(error, true)}</FormNotice>
      <Button variant="paper" disabled={pending} onPress={refresh}>
        {pending ? "Đang kiểm tra..." : "Thử kiểm tra lại"}
      </Button>
    </View>
  );
}
