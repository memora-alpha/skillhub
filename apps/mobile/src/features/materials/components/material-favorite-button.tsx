import { useState } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { InfoModal } from "@/components/InfoModal";
import { appColors } from "@/constants/theme";
import { FormNotice } from "@/components/FormNotice";
import { useConnectionCommand } from "@/features/connections";
import { useMaterialFavorite } from "../hooks/use-material-favorites";
import { useMaterialsApi } from "../hooks/use-materials";
import { materialFailure } from "../utils/material-failure";
import { materialStyles as styles } from "./material.styles";

function favoriteLabel(pending: boolean, uncertain: boolean, value?: boolean) {
  if (pending) return "Đang cập nhật…";
  if (uncertain) return "Thử lại thao tác lưu";
  return value ? "Bỏ lưu" : "Lưu để xem sau";
}

export function MaterialFavoriteButton({
  materialId,
  saved,
  iconOnly = false,
  style,
}: Readonly<{
  materialId: string;
  saved?: boolean;
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const api = useMaterialsApi();
  const state = useMaterialFavorite(materialId, saved === undefined);
  const command = useConnectionCommand<boolean>([["materials", "favorites"]]);
  const [dismissedError, setDismissedError] = useState<unknown>();
  const value = saved ?? state.data;
  const checking =
    saved === undefined &&
    (state.isFetching || value === undefined || !!state.error);
  const error = command.error || (saved === undefined && state.error);
  const label = favoriteLabel(command.pending, command.uncertain, value);
  const bookmarkIcon = value ? "bookmark-check" : "bookmark";
  const disabled = command.pending || (!command.uncertain && checking);
  const toggle = () => {
    setDismissedError(undefined);
    if (command.uncertain) void command.retry();
    else if (value !== undefined)
      void command.run(JSON.stringify([materialId, !value]), () =>
        api.setFavorite(materialId, !value),
      );
  };
  return (
    <View style={[!iconOnly && styles.section, style]}>
      {iconOnly ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{
            selected: value === true,
            busy: command.pending,
            disabled,
          }}
          disabled={disabled}
          onPress={toggle}
          style={({ pressed }) => [
            styles.favoriteIcon,
            (pressed || disabled) && styles.pressed,
          ]}
        >
          <Icon
            name={command.uncertain ? "refresh" : bookmarkIcon}
            size={22}
            color={appColors.primary}
          />
        </Pressable>
      ) : (
        <Button
          variant="paper"
          size="sm"
          leadingIcon={bookmarkIcon}
          accessibilityState={{
            selected: value === true,
            busy: command.pending,
          }}
          disabled={disabled}
          onPress={toggle}
        >
          {label}
        </Button>
      )}
      {saved === undefined && !!state.error && (
        <Button variant="ghost" size="sm" onPress={() => void state.refetch()}>
          Đọc lại trạng thái lưu
        </Button>
      )}
      {!iconOnly && !!error && (
        <FormNotice tone="error" compact>
          {materialFailure(error)}
        </FormNotice>
      )}
      {iconOnly && !!error && error !== dismissedError && (
        <InfoModal
          title="Chưa cập nhật được mục đã lưu"
          titleStyle={styles.heading}
          onClose={() => setDismissedError(error)}
        >
          <Text style={styles.text}>{materialFailure(error)}</Text>
          {command.uncertain && (
            <Button variant="paper" disabled={command.pending} onPress={toggle}>
              Thử lại thao tác lưu
            </Button>
          )}
        </InfoModal>
      )}
    </View>
  );
}
