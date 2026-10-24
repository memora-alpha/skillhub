import { useMemo, useRef, type ReactNode } from "react";
import { Host, BottomSheet, RNHostView } from "@expo/ui";
import {
  Keyboard,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { appColors, fonts, typography } from "@/constants/theme";

export function RequestPickerSheet({
  title,
  open,
  onClose,
  children,
  closeLabel = "Xong",
  closeIcon = false,
}: Readonly<{
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
  closeIcon?: boolean;
}>) {
  const { height } = useWindowDimensions();
  const frame = useRef({ open: false, height: Math.min(height * 0.8, 640) });
  if (open && !frame.current.open)
    frame.current.height = Math.min(height * 0.8, 640);
  frame.current.open = open;
  const sheetHeight = frame.current.height;
  const snapPoints = useMemo(() => [{ height: sheetHeight }], [sheetHeight]);
  const close = () => {
    Keyboard.dismiss();
    onClose();
  };
  return (
    <Host
      style={{ position: "absolute" }}
      pointerEvents="box-none"
      colorScheme="light"
    >
      <BottomSheet
        isPresented={open}
        onDismiss={close}
        snapPoints={snapPoints}
        contentPadding={0}
        containerColor={appColors.surface}
      >
        <RNHostView matchContents={{ vertical: true }}>
          <View
            style={{ height: Math.max(0, sheetHeight - 32), width: "100%" }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  flex: 1,
                  fontFamily: fonts.bold,
                  ...typography.heading,
                  color: appColors.ink,
                }}
              >
                {title}
              </Text>
              {closeIcon ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  onPress={close}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Icon name="close" size={22} color={appColors.body} />
                </Pressable>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ minHeight: 44 }}
                  onPress={close}
                >
                  {closeLabel}
                </Button>
              )}
            </View>
            <KeyboardFormScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: 32,
                gap: 12,
              }}
              contentInsetAdjustmentBehavior="automatic"
            >
              {children}
            </KeyboardFormScrollView>
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}
