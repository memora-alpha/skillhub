import { useLocalSearchParams } from "expo-router";
import { PublicProfilePreviewScreen } from "@/features/profile";

export default function PublicProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  return <PublicProfilePreviewScreen userId={userId} />;
}
