import { useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { Button } from "./Button";
import { Copy } from "./feature-page";
import { FormNotice } from "./FormNotice";
import { uploadBody, type UploadedFile } from "@/lib/http/file-upload";
import { errorMessage } from "@/lib/http/errors";
import { FileSelectionError, photoUploadAsset } from "@/lib/http/picked-image";

export function ServerFilePicker({
  files,
  onChange,
  upload,
  status,
  isCurrent,
  maxCount = 5,
  maxBytes = 10_000_000,
  disabled = false,
  compact = false,
  allowPhotos = false,
  checkOnSubmit = false,
  onBusyChange,
  types = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
}: Readonly<{
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  upload: (body: FormData) => Promise<{ fileId: string; state: string }>;
  status: (id: string) => Promise<{ fileId: string; state: string }>;
  isCurrent: () => boolean;
  maxCount?: number;
  maxBytes?: number;
  disabled?: boolean;
  compact?: boolean;
  allowPhotos?: boolean;
  checkOnSubmit?: boolean;
  onBusyChange?: (busy: boolean) => void;
  types?: string[];
}>) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>();
  async function work(task: () => Promise<void>) {
    if (lock.current || disabled || !isCurrent()) return;
    lock.current = true;
    setPending(true);
    onBusyChange?.(true);
    setError(undefined);
    try {
      await task();
    } catch (cause) {
      if (isCurrent())
        setError(
          cause instanceof FileSelectionError
            ? cause.message
            : errorMessage(cause),
        );
    } finally {
      lock.current = false;
      if (isCurrent()) setPending(false);
      if (isCurrent()) onBusyChange?.(false);
    }
  }
  async function uploadAsset(file: DocumentPicker.DocumentPickerAsset) {
    if (!isCurrent() || files.length >= maxCount) return;
    if (
      !file.size ||
      !Number.isFinite(file.size) ||
      file.size < 0 ||
      file.size > maxBytes
    ) {
      setError(`Chọn tệp từ 1 byte đến ${maxBytes / 1_000_000} MB.`);
      return;
    }
    const receipt = await upload(uploadBody(file));
    if (isCurrent()) onChange([...files, { ...receipt, name: file.name }]);
  }
  return (
    <>
      {files.map((file) =>
        compact ? (
          <View key={file.fileId} style={styles.file}>
            <Icon name="file" size={20} color={colors.forest} />
            <View style={styles.grow}>
              <Text numberOfLines={2} style={styles.name}>
                {file.name}
              </Text>
              <Text style={styles.hint}>
                {file.state === "READY"
                  ? "Sẵn sàng"
                  : [
                        "REJECTED",
                        "FAILED",
                        "INFECTED",
                        "SCAN_FAILED",
                        "DELETED",
                        "EXPIRED",
                      ].includes(file.state)
                    ? "Tệp chưa hợp lệ"
                    : checkOnSubmit && !disabled
                      ? "Kiểm tra khi gửi"
                      : "Đang kiểm tra"}
              </Text>
            </View>
            {file.state === "READY" && (
              <Icon name="check-circle" size={18} color={colors.forest} />
            )}
            <Button
              variant="ghost"
              accessibilityLabel={`Bỏ tệp ${file.name}`}
              disabled={disabled || pending}
              style={styles.remove}
              onPress={() => {
                if (!disabled && !pending && isCurrent())
                  onChange(files.filter((item) => item.fileId !== file.fileId));
              }}
            >
              <Icon name="close" size={18} color={colors.body} />
            </Button>
          </View>
        ) : (
          <Copy key={file.fileId}>
            {file.name}: {file.state === "READY" ? "Sẵn sàng" : file.state}
          </Copy>
        ),
      )}
      <Copy muted size={compact ? "hint" : "body"}>
        {compact
          ? `Tối đa ${maxCount} tệp · ${maxBytes / 1_000_000} MB/tệp.${checkOnSubmit ? " Tệp được kiểm tra khi gửi." : " Chỉ gửi khi tệp sẵn sàng."}`
          : `Tối đa ${maxCount} tệp, ${maxBytes / 1_000_000} MB/tệp. Tệp cần được quét an toàn trước khi gửi.`}
      </Copy>
      {error && (
        <FormNotice compact={compact} tone="error">
          {error}
        </FormNotice>
      )}
      <View style={allowPhotos ? styles.sources : undefined}>
        {allowPhotos && (
          <Button
            variant="paper"
            leadingIcon="image"
            style={styles.sourceButton}
            disabled={disabled || pending || files.length >= maxCount}
            onPress={() => {
              void work(async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsMultipleSelection: false,
                  allowsEditing: false,
                  preferredAssetRepresentationMode:
                    ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                      .Compatible,
                  quality: 1,
                  base64: false,
                  exif: false,
                });
                if (result.canceled || !isCurrent()) return;
                const selected = result.assets[0];
                if (!selected)
                  throw new FileSelectionError(
                    "Không đọc được ảnh đã chọn. Hãy chọn lại.",
                  );
                const asset = photoUploadAsset(selected);
                if (!types.includes(asset.mimeType!))
                  throw new FileSelectionError(
                    "Định dạng ảnh không được hỗ trợ.",
                  );
                await uploadAsset(asset);
              });
            }}
          >
            Chọn ảnh
          </Button>
        )}
        <Button
          variant="paper"
          leadingIcon={compact ? "paperclip" : undefined}
          style={allowPhotos ? styles.sourceButton : undefined}
          disabled={disabled || pending || files.length >= maxCount}
          onPress={() => {
            void work(async () => {
              const result = await DocumentPicker.getDocumentAsync({
                type: types,
                multiple: false,
                copyToCacheDirectory: true,
              });
              if (result.canceled || !isCurrent()) return;
              await uploadAsset(result.assets[0]!);
            });
          }}
        >
          {allowPhotos
            ? "Chọn tệp"
            : pending
              ? "Đang xử lý tệp…"
              : compact
                ? "Thêm tệp đính kèm"
                : "Chọn và tải tệp lên"}
        </Button>
      </View>
      {!!files.length && !checkOnSubmit && (
        <Button
          variant="paper"
          disabled={disabled || pending}
          onPress={() => {
            void work(async () => {
              const checked = await Promise.all(
                files.map(async (file) => ({
                  ...file,
                  ...(await status(file.fileId)),
                })),
              );
              if (isCurrent()) onChange(checked);
            });
          }}
        >
          Kiểm tra trạng thái tệp
        </Button>
      )}
      {!!files.length && !compact && (
        <Button
          variant="ghost"
          disabled={disabled || pending}
          onPress={() => onChange([])}
        >
          Bỏ các tệp đã chọn
        </Button>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  remove: { width: 44, minHeight: 44, padding: 0 },
  sources: { flexDirection: "row", gap: 10 },
  sourceButton: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  grow: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
  hint: { fontFamily: fonts.body, ...typography.secondary, color: colors.body },
});
