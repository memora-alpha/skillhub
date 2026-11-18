import { useState } from "react";
import { Text, View } from "react-native";
import { ServerFilePicker } from "@/components/server-file-picker";
import { Button } from "@/components/Button";
import { MaterialCoverPreview } from "./material-cover-preview";
import { materialThumbnailUrl } from "../utils/material-thumbnail";
import type { useMaterialEditor } from "../hooks/use-material-editor";
import {
  materialCoverTypes,
  prepareMaterialCoverUpload,
} from "../utils/material-cover-upload";
import { materialStyles as styles } from "./material.styles";

export function MaterialCoverEditor({
  editor,
}: Readonly<{ editor: ReturnType<typeof useMaterialEditor> }>) {
  const [localPreview, setLocalPreview] = useState<string>();
  const cover = editor.material?.cover;
  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Ảnh bìa (không bắt buộc)</Text>
      <Text style={styles.caption}>
        JPEG, PNG hoặc WEBP · tối đa 10 MB · từ 640 × 360 px.
      </Text>
      {cover?.attached &&
        !editor.coverFiles.length &&
        (editor.removeCover ? (
          <View style={styles.row}>
            <Text style={styles.caption}>
              Đã gỡ ảnh bìa. Bấm Lưu để áp dụng.
            </Text>
            <Button
              variant="ghost"
              size="sm"
              disabled={editor.disabled}
              onPress={() => editor.setRemoveCover(false)}
            >
              Hoàn tác
            </Button>
          </View>
        ) : (
          editor.material && (
            <View style={styles.section}>
              <MaterialCoverPreview
                uri={materialThumbnailUrl(editor.material, true)}
                expiresAt={
                  cover.preview.kind === "GENERATED"
                    ? cover.preview.expiresAt
                    : undefined
                }
                disabled={editor.disabled}
                onRemove={() => editor.setRemoveCover(true)}
              />
              {cover.processingStatus !== "READY" && (
                <Text style={styles.caption}>
                  {cover.processingStatus === "FAILED"
                    ? "Chưa tạo được ảnh xem trước. Bạn có thể đổi ảnh bìa."
                    : "Ảnh xem trước đang được xử lý."}
                </Text>
              )}
            </View>
          )
        ))}
      <ServerFilePicker
        compact
        autoCheck
        showHint={false}
        pickerLabel={
          cover?.attached && !editor.removeCover
            ? "Đổi ảnh bìa"
            : "Chọn ảnh bìa"
        }
        files={editor.coverFiles}
        renderFile={({ file, remove, disabled, statusLabel }) => (
          <View style={styles.section}>
            <MaterialCoverPreview
              uri={localPreview}
              disabled={disabled}
              onRemove={remove}
            />
            {file.state !== "READY" && (
              <Text style={styles.caption}>{statusLabel}</Text>
            )}
          </View>
        )}
        onChange={(files) => {
          editor.setCoverFiles(files);
          if (files.length) editor.setRemoveCover(false);
        }}
        upload={editor.api.uploadCover}
        status={editor.api.fileStatus}
        isCurrent={editor.runtime.isCurrent}
        onBusyChange={editor.setCoverBusy}
        maxCount={1}
        maxBytes={10_000_000}
        types={materialCoverTypes}
        formats="JPEG (.jpg, .jpeg), PNG (.png) hoặc WEBP (.webp)"
        prepareAsset={(asset) => {
          const selected = prepareMaterialCoverUpload(asset);
          setLocalPreview(selected.uri);
          return selected;
        }}
        disabled={editor.disabled}
      />
    </View>
  );
}
