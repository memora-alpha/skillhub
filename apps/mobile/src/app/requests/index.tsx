import { Redirect } from "expo-router";
import { learningRoutes } from "@/constants/navigation";
export default function Screen() {
  return <Redirect href={learningRoutes.requests} />;
}
