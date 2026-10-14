import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { evidenceImageAsset } from "./evidence-image-asset";
import { evidenceFormats, type EvidenceAsset } from "./evidence-draft";

export type EvidenceSource = "photos" | "files";

export async function pickEvidence(
  source: EvidenceSource,
  remaining: number,
): Promise<EvidenceAsset[]> {
  if (source === "photos") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      allowsEditing: false,
      selectionLimit: remaining,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 1,
      base64: false,
      exif: false,
    });
    return result.canceled ? [] : result.assets.map(evidenceImageAsset);
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: [evidenceFormats.pdf!, evidenceFormats.doc!, evidenceFormats.docx!],
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
  });
  return result.canceled ? [] : result.assets;
}
