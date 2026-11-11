import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/choice-group";
import { uiLabel } from "@/constants/ui-copy";
import { reportReasons, materialReportReasons } from "../api/reports-api";
import { reportReasonIcon } from "../utils/report-presentation";
import { reportStyles as s } from "./report.styles";
export function ReportReasonField({
  value,
  disabled,
  onChange,
  target,
}: Readonly<{
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  target: "SESSION" | "MATERIAL";
}>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.label}>Loại vấn đề</Text>
      <Button
        variant="paper"
        leadingIcon={reportReasonIcon(value)}
        icon="chevron"
        accessibilityLabel={`Chọn loại vấn đề: ${uiLabel(value)}`}
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
      >
        <Text style={s.linkText}>{uiLabel(value)}</Text>
      </Button>
      {open && (
        <ChoiceGroup
          label="Chọn loại vấn đề"
          options={target === "SESSION" ? reportReasons : materialReportReasons}
          value={value}
          disabled={disabled}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}
