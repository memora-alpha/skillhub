import { Platform } from "react-native";
import { File } from "expo-file-system";
import { getDocumentAsync } from "expo-document-picker";
import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from "expo-image-picker";
import { photoUploadAsset } from "@/lib/http/picked-image";
import { chatFormats, type ChatFile } from "./chat-file";

export type ChatAttachmentSource = "photos" | "files";

export async function pickChatAttachment(
  source: ChatAttachmentSource,
): Promise<ChatFile | undefined> {
  if (source === "photos") {
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      allowsEditing: false,
      preferredAssetRepresentationMode:
        UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 1,
      base64: false,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return undefined;
    const asset = result.assets[0];
    const file = photoUploadAsset({
      ...asset,
      fileName: asset.fileName || "anh",
    });
    if (file.size === undefined && Platform.OS !== "web")
      file.size = new File(file.uri).size;
    return { ...file, previewUri: file.uri };
  }
  const result = await getDocumentAsync({
    type: [chatFormats.pdf!, chatFormats.docx!, chatFormats.txt!],
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  return result.canceled ? undefined : result.assets[0];
}
