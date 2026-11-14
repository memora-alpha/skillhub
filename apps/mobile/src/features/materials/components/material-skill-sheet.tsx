import { useMemo, useState, type ReactNode } from "react";
import { Host, BottomSheet, RNHostView } from "@expo/ui";
import { Modal, useWindowDimensions } from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { PickerSheetHeader } from "@/components/picker-sheet-header";
import { appColors } from "@/constants/theme";

export function MaterialSkillSheet({
  onClose,
  children,
}: Readonly<{ onClose: () => void; children: ReactNode }>) {
  const { height } = useWindowDimensions();
  const [sheetHeight] = useState(() => Math.min(height * 0.8, 640));
  const [ready, setReady] = useState(false);
  const snapPoints = useMemo(() => [{ height: sheetHeight }], [sheetHeight]);

  return (
    // Keep the list outside the editor's ScrollView/VirtualizedList contexts.
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      // Present only after the native modal's host window is available.
      onShow={() => setReady(true)}
      onRequestClose={onClose}
    >
      <Host style={{ flex: 1 }} colorScheme="light">
        <BottomSheet
          isPresented={ready}
          onDismiss={onClose}
          showDragIndicator
          snapPoints={snapPoints}
          contentPadding={0}
          containerColor={appColors.canvas}
        >
          <RNHostView matchContents={{ vertical: true }}>
            <SafeAreaView
              edges={["bottom"]}
              style={{ height: Math.max(0, sheetHeight - 32), width: "100%" }}
            >
              <PickerSheetHeader
                title="Chọn kỹ năng"
                onClose={onClose}
                closeIcon
                closeLabel="Đóng bộ chọn kỹ năng"
              />
              {children}
            </SafeAreaView>
          </RNHostView>
        </BottomSheet>
      </Host>
    </Modal>
  );
}
