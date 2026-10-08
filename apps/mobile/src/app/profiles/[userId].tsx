import { useLocalSearchParams } from "expo-router";
import { PublicProfileScreen } from "@/features/profile";

export default function PublicProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  return <PublicProfileScreen userId={userId} />;
}
