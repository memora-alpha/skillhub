import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { formStyles } from "./skill-form-styles";
import { CatalogListModal } from "./CatalogListModal";
import type { CatalogSkill } from "../types/skills";

export function CatalogPicker({
  selected,
  disabled,
  onSelect,
}: {
  selected?: CatalogSkill;
  disabled: boolean;
  onSelect: (skill: CatalogSkill) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Text style={formStyles.label}>Kỹ năng</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selected
            ? `Kỹ năng: ${selected.name} · chọn lại`
            : "Chọn kỹ năng từ danh mục"
        }
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[formStyles.selector, disabled && { opacity: 0.6 }]}
        onPress={() => setOpen(true)}
      >
        <Icon name="book" size={20} color={appColors.primary} />
        <Text style={[formStyles.label, { flex: 1 }]}>
          {selected?.name ?? "Chọn từ danh mục"}
        </Text>
        <Icon name="chevron" size={16} color={appColors.muted} />
      </Pressable>
      <CatalogListModal
        open={open}
        search={search}
        selected={selected}
        disabled={disabled}
        onSearch={setSearch}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
      />
    </View>
  );
}
