import { Platform, type ViewStyle } from "react-native";
import { colors } from "./theme";

const noShadow: ViewStyle = {};

export const shadows = {
  sm:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
      default: noShadow,
    }) ?? noShadow,
  md:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: noShadow,
    }) ?? noShadow,
  lg:
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: noShadow,
    }) ?? noShadow,
} satisfies Record<string, ViewStyle>;
