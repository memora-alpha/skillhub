import { StyleSheet, Text, View } from "react-native";
import { Host, Picker } from "@expo/ui";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import {
  timezoneOptions,
  timezoneLabel,
  timezoneSample,
} from "../utils/preferences";
import { SettingsSection, settingsStyles } from "./SettingsUI";

export function TimezoneField({
  value,
  disabled,
  onChange,
}: Readonly<{
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}>) {
  const sample = timezoneSample(value.trim());
  return (
    <>
      {sample && (
        <View style={styles.clock}>
          <View style={styles.clockHeading}>
            <Icon name="clock" size={16} color={colors.forest} />
            <Text style={styles.clockLabel}>Giờ tại nơi bạn chọn</Text>
          </View>
          <Text selectable style={styles.sample}>
            {sample}
          </Text>
          <Text style={styles.zone}>{timezoneLabel(value.trim())}</Text>
        </View>
      )}
      <SettingsSection title="Chọn múi giờ">
        <View style={settingsStyles.padded}>
          <Text style={settingsStyles.label}>Quốc gia / thành phố</Text>
          <Host
            matchContents={{ vertical: true }}
            style={settingsStyles.nativeControl}
            seedColor={colors.primary}
          >
            <Picker
              selectedValue={value.trim()}
              onValueChange={onChange}
              enabled={!disabled}
            >
              {!timezoneOptions.some((zone) => zone === value.trim()) && (
                <Picker.Item
                  label={value.trim() || "Chọn múi giờ"}
                  value={value.trim()}
                />
              )}
              {timezoneOptions.map((zone) => (
                <Picker.Item
                  key={zone}
                  label={timezoneLabel(zone)}
                  value={zone}
                />
              ))}
            </Picker>
          </Host>
        </View>
      </SettingsSection>
    </>
  );
}

const styles = StyleSheet.create({
  clock: {
    padding: 20,
    gap: 12,
    borderRadius: appRadius.card,
    backgroundColor: colors.forestSoft,
  },
  clockHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  clockLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.forest,
  },
  sample: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.forest,
    fontVariant: ["tabular-nums"],
  },
  zone: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.forest,
  },
});
