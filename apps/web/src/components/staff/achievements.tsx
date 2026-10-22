"use client";
import { Badge, Card, Empty, PageHeader } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import { useAchievements } from "./use-achievements";

export function AchievementsScreen() {
  const { data, error, loading, saving, success, reload, select } =
    useAchievements();
  return (
    <>
      <PageHeader
        title="Thành tích & danh hiệu"
        desc="Thành tích đã mở khóa và danh hiệu công khai của tài khoản đang đăng nhập."
        actions={
          <button
            className="btn"
            type="button"
            disabled={loading || saving}
            onClick={() => void reload()}
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        }
      />
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <output className="staff-success">
          Đã cập nhật danh hiệu trên hồ sơ.
        </output>
      )}
      {loading && !data && (
        <output className="staff-state">Đang tải thành tích…</output>
      )}
      {data && (
        <>
          <Card
            title="Danh hiệu đang chọn"
            actions={
              <button
                type="button"
                className="btn"
                disabled={saving || loading || !data.selectedTitle}
                onClick={() => void select(null)}
              >
                {saving ? "Đang lưu…" : "Ẩn danh hiệu"}
              </button>
            }
          >
            <p>{data.selectedTitle ?? "Không hiển thị danh hiệu"}</p>
            <p className="muted">
              Danh hiệu đã chọn hiển thị trên hồ sơ công khai của bạn.
            </p>
          </Card>
          <Card title={`Thành tích đã mở khóa (${data.items.length})`} flush>
            {!data.items.length ? (
              <Empty
                title="Chưa có thành tích được mở khóa"
                desc="Thành tích sẽ xuất hiện khi bạn đạt các mốc của hệ thống."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Danh hiệu</th>
                      <th>Điều kiện</th>
                      <th>Ngày mở khóa</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.code}>
                        <td>
                          <strong>{item.title}</strong>
                        </td>
                        <td>{item.description}</td>
                        <td>{fmtDateTime(item.unlockedAt)}</td>
                        <td>
                          {data.selectedTitle === item.title ? (
                            <Badge tone="ok">Đang chọn</Badge>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={saving || loading}
                              onClick={() => void select(item.code)}
                            >
                              Chọn danh hiệu
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
