import { useLocalSearchParams } from "expo-router";
import { TagRequestDetailScreen } from "@/features/tag-requests";

export default function Screen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <TagRequestDetailScreen id={id} />;
}
