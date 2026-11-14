import { useMemo, useRef, type ReactNode } from "react";
import { Host, BottomSheet, RNHostView } from "@expo/ui";
import { Keyboard, View, useWindowDimensions } from "react-native";
import { PickerSheetHeader } from "@/components/picker-sheet-header";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { ScreenLoadingBoundary } from "@/components/ScreenLoadingBoundary";
import { appColors } from "@/constants/theme";

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
            <PickerSheetHeader
              title={title}
              onClose={close}
              closeLabel={closeLabel}
              closeIcon={closeIcon}
            />
            <ScreenLoadingBoundary>
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
            </ScreenLoadingBoundary>
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}
