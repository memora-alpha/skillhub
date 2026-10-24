import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { AppError, errorMessage } from "@/lib/http/errors";
import { useAchievements } from "../hooks/use-achievements";

export function AchievementsScreen() {
  const { query, mutation, enabled, data } = useAchievements();
  const saving = mutation.isPending;
  return (
    <FeaturePage title="Thành tích & danh hiệu" back="/profile" demo={false}>
      {!enabled ? (
        <Copy>Đăng nhập để xem thành tích của bạn.</Copy>
      ) : (
        <>
          <Button
            variant="paper"
            disabled={query.isFetching || saving}
            onPress={() => {
              mutation.reset();
              void query.refetch();
            }}
          >
            {query.isFetching ? "Đang cập nhật…" : "Làm mới thành tích"}
          </Button>
          {query.isLoading && (
            <ActivityIndicator accessibilityLabel="Đang tải thành tích" />
          )}
          {data === null && (
            <Copy>Tài khoản hiện không có quyền xem thành tích.</Copy>
          )}
          {query.error && (
            <Panel title="Chưa thể cập nhật thành tích">
              <Copy>{errorMessage(query.error)}</Copy>
            </Panel>
          )}
          {mutation.error && (
            <Panel title="Chưa thể lưu danh hiệu">
              <Copy>
                {mutation.error instanceof AppError &&
                mutation.error.code === "TITLE_NOT_UNLOCKED"
                  ? "Danh hiệu này chưa được mở khóa hoặc không còn khả dụng. Hãy làm mới thành tích."
                  : errorMessage(mutation.error)}
              </Copy>
            </Panel>
          )}
          {mutation.isSuccess && <Copy>Đã cập nhật danh hiệu trên hồ sơ.</Copy>}
          {data && (
            <>
              <Panel title="Danh hiệu đang chọn" accent>
                <Copy>{data.selectedTitle ?? "Không hiển thị danh hiệu"}</Copy>
                <Button
                  variant="paper"
                  disabled={saving || query.isFetching || !data.selectedTitle}
                  onPress={() => mutation.mutate(null)}
                >
                  {saving && mutation.variables === null
                    ? "Đang lưu…"
                    : "Ẩn danh hiệu"}
                </Button>
              </Panel>
              {!data.items.length && (
                <EmptyState
                  title="Chưa có thành tích được mở khóa"
                  description="Thành tích sẽ xuất hiện khi bạn đạt các mốc của hệ thống."
                />
              )}
              {data.items.map((item) => {
                const selected = data.selectedTitle === item.title;
                let label = "Chọn danh hiệu";
                if (selected) label = "Đang chọn";
                else if (saving && mutation.variables === item.code)
                  label = "Đang lưu…";
                return (
                  <Panel key={item.code} title={item.title}>
                    <Badge
                      label={
                        selected ? "Đang hiển thị trên hồ sơ" : "Đã mở khóa"
                      }
                      variant="success"
                    />
                    <Copy>{item.description}</Copy>
                    <Copy muted>
                      Mở khóa ngày{" "}
                      {new Date(item.unlockedAt).toLocaleDateString("vi-VN")}
                    </Copy>
                    <Button
                      disabled={saving || selected || query.isFetching}
                      onPress={() => mutation.mutate(item.code)}
                    >
                      {label}
                    </Button>
                  </Panel>
                );
              })}
            </>
          )}
        </>
      )}
    </FeaturePage>
  );
}
