import { useRef, useState, type ReactNode } from "react";
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
import { FileSelectionError, photoUploadAsset } from "@/lib/http/picked-image";
import {
  filePickerError,
  type FilePickerPhase,
} from "@/lib/http/file-picker-error";
import { AutomaticFileStatus } from "./automatic-file-status";

function fileStatusLabel(
  state: string,
  checkOnSubmit: boolean,
  disabled: boolean,
) {
  if (state === "READY") return "Sẵn sàng";
  if (state === "REJECTED" || state === "INFECTED")
    return "Tệp không đạt kiểm tra an toàn. Hãy chọn tệp khác.";
  if (state === "SCAN_FAILED")
    return "Không kiểm tra được tệp. Hãy chọn tệp khác hoặc thử tải lại sau.";
  if (
    [
      "FAILED",
      "UPLOAD_FAILED",
      "DELETED",
      "EXPIRED",
      "CLEANUP_PENDING",
    ].includes(state)
  )
    return "Tệp chưa hợp lệ";
  if (checkOnSubmit && !disabled) return "Kiểm tra khi gửi";
  if (state === "UPLOADING") return "Đang tải tệp lên";
  if (state === "QUARANTINED") return "Đang chờ kiểm tra";
  if (state === "SCANNING") return "Đang quét an toàn";
  return "Tệp chưa sẵn sàng. Hãy chọn tệp khác.";
}

function fileLimitHint(
  compact: boolean,
  checkOnSubmit: boolean,
  maxCount: number,
  maxBytes: number,
) {
  const size = maxBytes / 1_000_000;
  if (!compact)
    return `Tối đa ${maxCount} tệp, ${size} MB/tệp. Tệp cần được quét an toàn trước khi gửi.`;
  const hint = checkOnSubmit
    ? "Tệp được kiểm tra khi gửi."
    : "Chỉ gửi khi tệp sẵn sàng.";
  return `Tối đa ${maxCount} tệp · ${size} MB/tệp. ${hint}`;
}

function filePickerLabel(
  allowPhotos: boolean,
  pending: boolean,
  compact: boolean,
) {
  if (allowPhotos) return "Chọn tệp";
  if (pending) return "Đang xử lý tệp…";
  if (compact) return "Thêm tệp đính kèm";
  return "Chọn và tải tệp lên";
}

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
  prepareAsset = (asset) => asset,
  formats,
  autoCheck = false,
  showHint = true,
  pickerLabel,
  renderFile,
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
  status: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<{ fileId: string; state: string }>;
  isCurrent: () => boolean;
  maxCount?: number;
  maxBytes?: number;
  disabled?: boolean;
  compact?: boolean;
  allowPhotos?: boolean;
  checkOnSubmit?: boolean;
  onBusyChange?: (busy: boolean) => void;
  prepareAsset?: (
    asset: DocumentPicker.DocumentPickerAsset,
  ) => DocumentPicker.DocumentPickerAsset;
  formats?: string;
  autoCheck?: boolean;
  showHint?: boolean;
  pickerLabel?: string;
  renderFile?: (options: {
    file: UploadedFile;
    remove: () => void;
    disabled: boolean;
    statusLabel: string;
  }) => ReactNode;
  types?: string[];
}>) {
  const lock = useRef(false);
  const phase = useRef<FilePickerPhase>("selection");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>();
  async function work(
    task: () => Promise<void>,
    start: FilePickerPhase = "selection",
  ) {
    if (lock.current || disabled || !isCurrent()) return;
    lock.current = true;
    phase.current = start;
    setPending(true);
    onBusyChange?.(true);
    setError(undefined);
    try {
      await task();
    } catch (cause) {
      if (isCurrent()) setError(filePickerError(cause, phase.current, formats));
    } finally {
      lock.current = false;
      if (isCurrent()) setPending(false);
      if (isCurrent()) onBusyChange?.(false);
    }
  }
  async function uploadAsset(file: DocumentPicker.DocumentPickerAsset) {
    if (!isCurrent() || files.length >= maxCount) return;
    file = prepareAsset(file);
    if (file.size === 0) {
      setError("Tệp đang trống. Hãy chọn tệp có nội dung.");
      return;
    }
    if (
      file.size === undefined ||
      !Number.isFinite(file.size) ||
      file.size < 0
    ) {
      setError(
        "Không đọc được dung lượng tệp. Hãy tải tệp về thiết bị rồi chọn lại.",
      );
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `Tệp vượt quá ${maxBytes / 1_000_000} MB. Hãy chọn tệp nhỏ hơn.`,
      );
      return;
    }
    phase.current = "upload";
    const receipt = await upload(uploadBody(file));
    if (isCurrent()) onChange([...files, { ...receipt, name: file.name }]);
  }
  return (
    <>
      {files.map((file) =>
        renderFile ? (
          <View key={file.fileId}>
            {renderFile({
              file,
              disabled: disabled || pending,
              statusLabel: fileStatusLabel(file.state, checkOnSubmit, disabled),
              remove: () => {
                if (!disabled && !pending && isCurrent())
                  onChange(files.filter((item) => item.fileId !== file.fileId));
              },
            })}
          </View>
        ) : compact ? (
          <View key={file.fileId} style={styles.file}>
            <Icon name="file" size={20} color={colors.forest} />
            <View style={styles.grow}>
              <Text numberOfLines={2} style={styles.name}>
                {file.name}
              </Text>
              <Text style={styles.hint}>
                {fileStatusLabel(file.state, checkOnSubmit, disabled)}
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
      {showHint && (
        <Copy muted size={compact ? "hint" : "body"}>
          {formats ? `Định dạng hỗ trợ: ${formats}.\n` : ""}
          {fileLimitHint(compact, checkOnSubmit, maxCount, maxBytes)}
        </Copy>
      )}
      {error && (
        <FormNotice compact={compact} tone="error">
          {error}
        </FormNotice>
      )}
      {autoCheck && (
        <AutomaticFileStatus
          files={files}
          onChange={onChange}
          status={status}
          isCurrent={isCurrent}
          enabled={!disabled}
        />
      )}
      {(!autoCheck || files.length < maxCount) && (
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
                const selected = result.assets[0];
                if (!selected)
                  throw new FileSelectionError(
                    "Không đọc được tệp đã chọn. Hãy chọn lại.",
                  );
                await uploadAsset(selected);
              });
            }}
          >
            {!pending && pickerLabel
              ? pickerLabel
              : filePickerLabel(allowPhotos, pending, compact)}
          </Button>
        </View>
      )}
      {!!files.length && !checkOnSubmit && !autoCheck && (
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
            }, "status");
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
