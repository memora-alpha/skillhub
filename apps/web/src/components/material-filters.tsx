"use client";
const uuidPattern = "[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}";
const day = (value: string | null) =>
  value
    ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 10)
    : "";
export function MaterialFilters({
  value,
  onApply,
  owner = true,
  showQuery = true,
}: Readonly<{
  value: string;
  onApply: (query: string) => void;
  owner?: boolean;
  showQuery?: boolean;
}>) {
  const query = new URLSearchParams(value);
  return (
    <details>
      <summary>Bộ lọc tài liệu</summary>
      <form
        key={value}
        className="learner-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget),
            next = new URLSearchParams();
          for (const name of [
            ...(showQuery ? ["q"] : []),
            "skillId",
            "accessType",
            ...(owner ? ["ownerId"] : []),
          ]) {
            const entry = String(data.get(name) ?? "").trim();
            if (entry) next.set(name, entry);
          }
          for (const name of ["from", "to"]) {
            const entry = String(data.get(name) ?? "");
            if (entry)
              next.set(
                name,
                new Date(
                  entry +
                    (name === "from"
                      ? "T00:00:00+07:00"
                      : "T23:59:59.999+07:00"),
                ).toISOString(),
              );
          }
          onApply(next.toString());
        }}
      >
        {showQuery && (
          <label>
            Tên tài liệu
            <input
              name="q"
              maxLength={100}
              defaultValue={query.get("q") ?? ""}
            />
          </label>
        )}
        <label>
          Mã kỹ năng
          <input
            name="skillId"
            pattern={uuidPattern}
            defaultValue={query.get("skillId") ?? ""}
          />
        </label>
        <label>
          Loại truy cập
          <select
            name="accessType"
            defaultValue={query.get("accessType") ?? ""}
          >
            <option value="">Tất cả</option>
            <option value="FREE">Miễn phí</option>
            <option value="PAID">Có phí</option>
          </select>
        </label>
        {owner && (
          <label>
            Mã tác giả
            <input
              name="ownerId"
              pattern={uuidPattern}
              defaultValue={query.get("ownerId") ?? ""}
            />
          </label>
        )}
        <label>
          Từ ngày (giờ Việt Nam)
          <input
            type="date"
            name="from"
            defaultValue={day(query.get("from"))}
          />
        </label>
        <label>
          Đến ngày
          <input type="date" name="to" defaultValue={day(query.get("to"))} />
        </label>
        <button type="submit" className="btn">
          Áp dụng bộ lọc
        </button>
        <button type="button" className="btn" onClick={() => onApply("")}>
          Xóa bộ lọc
        </button>
      </form>
    </details>
  );
}
