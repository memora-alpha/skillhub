import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormNotice } from "@/components/FormNotice";
import { Copy, Panel, RouteButton } from "@/components/feature-page";
import { useConnections, useConnectionCommand } from "@/features/connections";
import {
  tagLabelSchema,
  tagRequestError,
  type TagRequest,
} from "../api/tag-requests-api";
import { useTagRequestsApi } from "../hooks/use-tag-requests";

export function TagRequestForm({ disabled }: Readonly<{ disabled: boolean }>) {
  const api = useTagRequestsApi();
  const runtime = useConnections();
  const command = useConnectionCommand<TagRequest>([["tag-requests"]]);
  const [label, setLabel] = useState("");
  const [validation, setValidation] = useState<string>();
  const [saved, setSaved] = useState<TagRequest>();
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );
  const received = (result?: TagRequest) => {
    if (!result || !focused.current || !runtime.isCurrent()) return;
    setSaved(result);
    setLabel("");
    setValidation(undefined);
  };
  const submit = async () => {
    if (
      !focused.current ||
      !runtime.isCurrent() ||
      disabled ||
      command.pending ||
      command.uncertain
    )
      return;
    const result = tagLabelSchema.safeParse(label);
    if (!result.success) {
      setValidation(result.error.issues[0]?.message ?? "Tên tag chưa hợp lệ.");
      return;
    }
    const value = result.data;
    setValidation(undefined);
    setSaved(undefined);
    received(await command.run(value, (key) => api.create(value, key)));
  };
  return (
    <Panel title="Đề xuất tag mới">
      <Copy muted>
        Tag cần được Admin duyệt trước khi có thể sử dụng. Đề xuất này độc lập
        với bài đăng.
      </Copy>
      <Input
        label="Tên tag"
        value={label}
        onChangeText={(value) => {
          setLabel(value);
          setValidation(undefined);
        }}
        editable={!disabled && !command.pending && !command.uncertain}
        maxLength={160}
        autoCapitalize="none"
        onSubmitEditing={() => void submit()}
      />
      {!!validation && <FormNotice tone="error">{validation}</FormNotice>}
      {!!command.error && (
        <FormNotice tone="error">{tagRequestError(command.error)}</FormNotice>
      )}
      {command.uncertain ? (
        <>
          <FormNotice tone="info">
            Chưa xác định được kết quả. Giữ nguyên đề xuất và kiểm tra lại cùng
            yêu cầu để tránh gửi trùng.
          </FormNotice>
          <Button
            disabled={disabled || command.pending}
            onPress={async () => received(await command.retry())}
          >
            {command.pending ? "Đang kiểm tra…" : "Kiểm tra lại đề xuất đã gửi"}
          </Button>
        </>
      ) : (
        <Button
          disabled={disabled || command.pending || !label.trim()}
          onPress={() => void submit()}
        >
          {command.pending ? "Đang gửi…" : "Gửi Admin duyệt"}
        </Button>
      )}
      {!disabled && saved && (
        <>
          <FormNotice tone="success">
            Đã ghi nhận đề xuất {saved.label}.
          </FormNotice>
          <RouteButton
            secondary
            href={{ pathname: "/tag-requests/[id]", params: { id: saved.id } }}
          >
            Theo dõi đề xuất vừa gửi
          </RouteButton>
        </>
      )}
    </Panel>
  );
}
