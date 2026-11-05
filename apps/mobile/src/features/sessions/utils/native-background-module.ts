import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { NativeBackgroundBridge } from "./native-background";

export function nativeBackgroundModule(): NativeBackgroundBridge | null {
  if (Platform.OS !== "android") return null;
  try {
    const module = requireOptionalNativeModule<NativeBackgroundBridge>(
      "SkillHubVideoEffects",
    );
    return module?.apiVersion() === 1 && module.isSupported() ? module : null;
  } catch {
    return null;
  }
}
