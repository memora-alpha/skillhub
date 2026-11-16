import { FilterBar } from "@/components/filter-bar";
import { IconAction } from "@/components/icon-action";
import type { SkillFilter } from "../utils/skill-filter";

const options: readonly { value: SkillFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "VERIFIED", label: "Đã xác minh" },
  { value: "PENDING", label: "Đang chờ xác minh" },
  { value: "UNVERIFIED", label: "Chưa xác minh" },
];
export function SkillFilters({
  value,
  onChange,
  onAdd,
  disabled = false,
}: Readonly<{
  value: SkillFilter;
  onChange: (value: SkillFilter) => void;
  onAdd?: () => void;
  disabled?: boolean;
}>) {
  return (
    <FilterBar
      options={options}
      value={value}
      onChange={onChange}
      label="Lọc kỹ năng"
      role="radio"
      action={
        onAdd ? (
          <IconAction
            icon="plus"
            label="Thêm kỹ năng"
            disabled={disabled}
            onPress={onAdd}
          />
        ) : undefined
      }
    />
  );
}
