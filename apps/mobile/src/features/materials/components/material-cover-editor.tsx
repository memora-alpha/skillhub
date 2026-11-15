import { Text, View } from "react-native";
import { ServerFilePicker } from "@/components/server-file-picker";
import type { useMaterialEditor } from "../hooks/use-material-editor";
import {
  materialCoverTypes,
  prepareMaterialCoverUpload,
} from "../utils/material-cover-upload";
import { materialStyles as styles } from "./material.styles";

export function MaterialCoverEditor({
  editor,
}: Readonly<{ editor: ReturnType<typeof useMaterialEditor> }>) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Ảnh bìa (không bắt buộc)</Text>
      <Text style={styles.caption}>
        JPEG, PNG hoặc WEBP · tối đa 10 MB · ít nhất 640 × 360 px. Ảnh phải là
        ảnh tĩnh.
      </Text>
      <ServerFilePicker
        compact
        autoCheck
        showHint={false}
        pickerLabel="Chọn ảnh bìa"
        files={editor.coverFiles}
        onChange={editor.setCoverFiles}
        upload={editor.api.uploadCover}
        status={editor.api.fileStatus}
        isCurrent={editor.runtime.isCurrent}
        onBusyChange={editor.setCoverBusy}
        maxCount={1}
        maxBytes={10_000_000}
        types={materialCoverTypes}
        formats="JPEG (.jpg, .jpeg), PNG (.png) hoặc WEBP (.webp)"
        prepareAsset={prepareMaterialCoverUpload}
        disabled={editor.disabled}
      />
    </View>
  );
}
