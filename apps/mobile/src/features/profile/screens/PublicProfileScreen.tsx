import { useLocalSearchParams } from "expo-router";
import { PublicProfilePreviewScreen } from "./public-profile-preview-screen";

export function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <PublicProfilePreviewScreen userId={id} />;
}
