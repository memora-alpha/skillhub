"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { achievementCopy, achievementTitle } from "@/lib/i18n/system-copy";
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
          <LoadingButton
            className="btn"
            type="button"
            disabled={loading || saving}
            onClick={() => void reload()}
            loading={!!(loading || saving)}
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </LoadingButton>
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
      {loading && !data && <LoadingSkeleton variant="page" />}
      {data && (
        <>
          <Card
            title="Danh hiệu đang chọn"
            actions={
              <LoadingButton
                type="button"
                className="btn"
                disabled={saving || loading || !data.selectedTitle}
                onClick={() => void select(null)}
                loading={!!(saving || loading)}
              >
                {saving ? "Đang lưu…" : "Ẩn danh hiệu"}
              </LoadingButton>
            }
          >
            <p>
              {achievementTitle(data.selectedTitle) ??
                "Không hiển thị danh hiệu"}
            </p>
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
                          <strong>{achievementCopy(item).title}</strong>
                        </td>
                        <td>{achievementCopy(item).description}</td>
                        <td>{fmtDateTime(item.unlockedAt)}</td>
                        <td>
                          {data.selectedTitle === item.title ? (
                            <Badge tone="ok">Đang chọn</Badge>
                          ) : (
                            <LoadingButton
                              type="button"
                              className="btn btn-sm"
                              disabled={saving || loading}
                              onClick={() => void select(item.code)}
                              loading={!!(saving || loading)}
                            >
                              Chọn danh hiệu
                            </LoadingButton>
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
