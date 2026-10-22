import { useState } from "react";
import { View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Panel, Copy, RouteButton } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import { useCatalog } from "../hooks/use-public-skill-queries";
import { useSkillSharers } from "../hooks/use-skill-sharers";
import type { CatalogSkill } from "../types/skills";

export function SkillSharersSearch() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogSkill>();
  const catalog = useCatalog(search, !selected);
  const length = [...search.trim().normalize("NFC")].length;
  const invalid = length === 1 || length > 100;
  const skills = [
    ...new Map(
      catalog.data?.pages
        .flatMap((page) => page.data)
        .filter((skill) => skill.status === "ACTIVE")
        .map((skill) => [skill.id, skill]) ?? [],
    ).values(),
  ];
  return (
    <>
      <Input
        label="Tìm kỹ năng muốn học"
        placeholder="Ví dụ: React, Tiếng Anh…"
        value={search}
        maxLength={100}
        onChangeText={(value) => {
          setSearch(value);
          setSelected(undefined);
        }}
        error={
          invalid
            ? "Nhập từ 2 đến 100 ký tự hoặc để trống để xem danh mục."
            : undefined
        }
      />
      {selected ? (
        <SharerResults
          key={selected.id}
          skill={selected}
          onChange={() => setSelected(undefined)}
        />
      ) : (
        !invalid && (
          <>
            <Copy>Chọn một kỹ năng để tìm người chia sẻ.</Copy>
            <ConnectionFeedback
              loading={catalog.isLoading}
              error={catalog.error}
              retry={catalog.refetch}
            />
            {catalog.data && !skills.length && !catalog.error && (
              <EmptyState
                title="Không tìm thấy kỹ năng"
                description="Thử từ khóa khác trong danh mục."
              />
            )}
            {skills.map((skill) => (
              <Button
                key={skill.id}
                variant="paper"
                onPress={() => setSelected(skill)}
              >
                {skill.name}
              </Button>
            ))}
            {catalog.hasNextPage && (
              <Button
                variant="paper"
                disabled={catalog.isFetching}
                onPress={() => void catalog.fetchNextPage()}
              >
                Xem thêm kỹ năng
              </Button>
            )}
          </>
        )
      )}
    </>
  );
}
function SharerResults({
  skill,
  onChange,
}: Readonly<{ skill: CatalogSkill; onChange: () => void }>) {
  const [verified, setVerified] = useState(false);
  const query = useSkillSharers(skill.id, verified);
  return (
    <>
      <Panel title={skill.name}>
        <Button variant="paper" onPress={onChange}>
          Chọn kỹ năng khác
        </Button>
        <Button variant="paper" onPress={() => setVerified((value) => !value)}>
          {verified ? "Đang lọc: đã xác minh" : "Chỉ kỹ năng đã xác minh"}
        </Button>
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
        >
          Làm mới kết quả
        </Button>
      </Panel>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {query.denied && (
        <Copy>
          Kỹ năng không còn khả dụng hoặc bạn không có quyền tìm kiếm.
        </Copy>
      )}
      {query.data && !query.items.length && !query.error && (
        <EmptyState
          title="Chưa có người chia sẻ phù hợp"
          description="Thử kỹ năng khác hoặc tắt bộ lọc xác minh."
        />
      )}
      {query.items.map((row) => (
        <Panel key={row.id} title={row.user.fullName}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar
              name={row.user.fullName}
              userId={row.user.userId}
              sourceUri={row.user.avatarUrl}
              size={48}
            />
            <Badge
              label={
                row.verificationStatus === "VERIFIED"
                  ? "Đã xác minh"
                  : "Chưa xác minh"
              }
              variant={
                row.verificationStatus === "VERIFIED" ? "success" : "default"
              }
            />
          </View>
          <Copy>
            {row.skillLevel?.name ?? row.level} · Uy tín{" "}
            {row.user.reputationScore}/100
          </Copy>
          <Copy>{row.description}</Copy>
          <RouteButton href={`/public-skills/${row.user.userId}/${row.id}`}>
            Xem kỹ năng & kết nối
          </RouteButton>
          <RouteButton secondary href={`/profiles/${row.user.userId}`}>
            Xem hồ sơ
          </RouteButton>
        </Panel>
      ))}
      {query.hasNextPage && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          Xem thêm người chia sẻ
        </Button>
      )}
    </>
  );
}
