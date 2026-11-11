import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { sectionStyles as styles } from "./session-section.styles";

export function SessionSection({
  title,
  icon,
  action,
  children,
}: Readonly<{
  title: string;
  icon: IconName;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Icon name={icon} size={18} color={colors.forest} />
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SessionInfoRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.caption}>{label}</Text>
      <Text selectable style={styles.rowValue}>
        {children}
      </Text>
    </View>
  );
}

// Reuse the app Button so disclosure content can contain existing RN forms and links.
export function SessionDisclosure({
  title,
  icon,
  children,
}: Readonly<{ title: string; icon?: IconName; children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.disclosure}>
      <Button
        variant="ghost"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.disclosureButton}
      >
        {icon && <Icon name={icon} size={18} color={colors.body} />}
        <Text style={styles.disclosureLabel}>{title}</Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <Icon name="chevron" size={18} color={colors.body} />
        </View>
      </Button>
      {open && <View style={styles.disclosureContent}>{children}</View>}
    </View>
  );
}

export function SessionActionRow({
  title,
  icon,
  disabled = false,
  onPress,
}: Readonly<{
  title: string;
  icon: IconName;
  disabled?: boolean;
  onPress: () => void;
}>) {
  return (
    <Button
      variant="ghost"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={styles.actionRow}
    >
      <Icon name={icon} size={18} color={colors.body} />
      <Text style={styles.disclosureLabel}>{title}</Text>
      <Icon name="chevron" size={18} color={colors.muted} />
    </Button>
  );
}
