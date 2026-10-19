import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { useMaterialsPreview, type Material } from "../context";
function MaterialCard({ material: m }: { material: Material }) {
  return (
    <Panel title={m.title}>
      <Badge label={m.access === "FREE" ? "Miễn phí" : `${m.price} CR`} />
      <Copy>{m.description}</Copy>
      <Copy muted>
        {m.skill} · phiên bản {m.version}
      </Copy>
      <RouteButton secondary href={`/materials/${m.id}`}>
        Xem tài liệu
      </RouteButton>
    </Panel>
  );
}
export function MaterialsScreen() {
  const { materials } = useMaterialsPreview();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const items = materials.filter(
    (m) =>
      m.status === "PUBLISHED" &&
      (filter === "Tất cả" || m.access === filter) &&
      `${m.title} ${m.skill}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <FeaturePage
      title="Tài liệu học tập"
      back="/home"
      subtitle="Tìm tài liệu hữu ích, do cộng đồng chia sẻ."
    >
      <Input
        label="Tìm tài liệu hoặc kỹ năng"
        value={search}
        onChangeText={setSearch}
      />
      <ChoiceGroup
        label="Loại tài liệu"
        options={["Tất cả", "FREE", "PAID"]}
        value={filter}
        onChange={setFilter}
      />
      <RouteButton secondary href="/materials/library">
        Thư viện của tôi
      </RouteButton>
      {items.map((m) => (
        <MaterialCard key={m.id} material={m} />
      ))}
      {!items.length && (
        <EmptyState
          title="Không tìm thấy tài liệu"
          description="Thử từ khóa hoặc bộ lọc khác."
        />
      )}
    </FeaturePage>
  );
}
export function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { materials, library, grantFree } = useMaterialsPreview();
  const m = materials.find((i) => i.id === id);
  return (
    <FeaturePage title="Chi tiết tài liệu" back="/materials">
      {!m ? (
        <EmptyState
          title="Không tìm thấy tài liệu"
          description="Tài liệu không có trong bản xem thử."
        />
      ) : (
        <>
          <Panel title={m.title}>
            <Badge label={m.status} />
            <Copy>{m.description}</Copy>
            <Copy>
              {m.skill} · v{m.version} ·{" "}
              {m.access === "FREE" ? "Miễn phí" : `${m.price} CR`}
            </Copy>
            {m.reason && <Copy>Lý do từ chối: {m.reason}</Copy>}
            <Copy muted>
              Chỉ hiển thị mô tả công khai. Tệp gốc cần quyền truy cập riêng.
            </Copy>
          </Panel>
          {m.status === "PUBLISHED" &&
            (library[id] || m.owner === "me" ? (
              <RouteButton href={`/materials/${id}/access`}>
                Mở tài liệu mẫu
              </RouteButton>
            ) : m.access === "FREE" ? (
              <Button variant="craft" onPress={() => grantFree(id)}>
                Nhận tài liệu miễn phí vào thư viện mẫu
              </Button>
            ) : (
              <RouteButton href={`/materials/${id}/purchase`}>
                Xem xác nhận mua
              </RouteButton>
            ))}
          {m.owner === "me" && (
            <>
              <RouteButton secondary href={`/materials/${id}/edit`}>
                Sửa thông tin / tạo phiên bản
              </RouteButton>
              <RouteButton secondary href="/materials/mine">
                Quản lý tài liệu tôi chia sẻ
              </RouteButton>
            </>
          )}
          <RouteButton
            secondary
            href={{ pathname: "/reports/new", params: { materialId: id } }}
          >
            Báo cáo tài liệu
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
export function MaterialLibraryScreen() {
  const { materials, library } = useMaterialsPreview();
  const items = materials.filter((m) => library[m.id]);
  return (
    <FeaturePage title="Thư viện của tôi" back="/materials">
      {items.map((m) => (
        <Panel key={m.id} title={m.title}>
          <Copy>Quyền truy cập mẫu · phiên bản đã nhận {library[m.id]}</Copy>
          <RouteButton href={`/materials/${m.id}/access`}>
            Mở tài liệu
          </RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Thư viện đang trống"
          description="Nhận tài liệu miễn phí hoặc xem tài liệu bạn đã mua."
        />
      )}
      <RouteButton secondary href="/materials">
        Khám phá tài liệu
      </RouteButton>
    </FeaturePage>
  );
}
export function MaterialAccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { materials, library } = useMaterialsPreview();
  const m = materials.find((i) => i.id === id);
  const allowed =
    m && m.status === "PUBLISHED" && (m.owner === "me" || library[id]);
  return (
    <FeaturePage title="Đọc tài liệu" back={`/materials/${id}`}>
      {!allowed ? (
        <EmptyState
          title="Chưa có quyền truy cập"
          description="Nhận tài liệu hoặc kiểm tra quyền mua trước khi mở tệp."
        />
      ) : (
        <Panel title={m.title}>
          <Copy>
            Tệp mẫu: {m.file} · phiên bản quyền truy cập{" "}
            {library[id] ?? m.version}
          </Copy>
          <Copy>
            Nội dung minh họa: chia một bài thực hành lớn thành từng bước nhỏ.
            Sau mỗi bước, hãy ghi lại điều đã hiểu và một câu hỏi cần trao đổi.
          </Copy>
          <Copy muted>
            Đây là bản đọc mẫu trong ứng dụng. Không có tệp gốc hoặc đường dẫn
            riêng tư được công khai.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
