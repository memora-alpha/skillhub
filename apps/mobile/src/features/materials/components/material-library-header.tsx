import { useRouter } from "expo-router";
import { FilterBar } from "@/components/filter-bar";
import { IconAction } from "@/components/icon-action";

const filters = [
  { value: "ALL", label: "Tất cả đơn" },
  { value: "FREE", label: "Miễn phí đã tải" },
  { value: "SUCCESS", label: "Đã mua" },
  { value: "REFUNDED", label: "Đã hoàn tiền" },
] as const;
export type MaterialLibraryFilter = (typeof filters)[number]["value"];
export function MaterialLibraryHeader({
  value,
  onChange,
  disabled = false,
}: Readonly<{
  value: MaterialLibraryFilter;
  onChange: (filter: MaterialLibraryFilter) => void;
  disabled?: boolean;
}>) {
  const router = useRouter();
  return (
    <FilterBar
      options={filters}
      value={value}
      onChange={onChange}
      label="Lọc thư viện tài liệu"
      disabled={disabled}
      action={
        <IconAction
          icon="compass"
          label="Khám phá tài liệu"
          onPress={() =>
            router.push({ pathname: "/discover", params: { tab: "materials" } })
          }
        />
      }
    />
  );
}
