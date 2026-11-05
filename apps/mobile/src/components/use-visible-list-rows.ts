import { useRef, useState } from "react";
import type { FlatListProps } from "react-native";

const viewabilityConfig = {
  minimumViewTime: 150,
  itemVisiblePercentThreshold: 10,
};

export function useVisibleListRows() {
  const [visibleIds, setVisibleIds] = useState(() => new Set<string>());
  const onViewableItemsChanged = useRef<
    NonNullable<FlatListProps<unknown>["onViewableItemsChanged"]>
  >(({ viewableItems }) => {
    setVisibleIds(
      new Set(
        viewableItems.filter((row) => row.isViewable).map((row) => row.key),
      ),
    );
  }).current;
  return { visibleIds, viewabilityConfig, onViewableItemsChanged };
}
