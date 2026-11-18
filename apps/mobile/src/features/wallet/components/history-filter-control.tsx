import { FilterBar } from "@/components/filter-bar";

type FilterControlProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};
export function HistoryFilterControl({
  label,
  value,
  options,
  onChange,
}: FilterControlProps) {
  return (
    <FilterBar
      label={label}
      value={value}
      options={options}
      onChange={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  );
}
