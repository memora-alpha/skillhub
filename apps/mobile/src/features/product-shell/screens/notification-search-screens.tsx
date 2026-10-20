import { useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import { Avatar } from "@/components/Avatar";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { publicProfiles } from "@/features/profile";
export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Người chia sẻ");
  const [verified, setVerified] = useState(false);
  const users = publicProfiles.filter(
    (p) =>
      p.skills.length &&
      `${p.name} ${p.skills.map((s) => s.name).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!verified || p.skills.some((s) => s.verified)),
  );
  return (
    <FeaturePage
      title="Tìm kiếm"
      back="/home"
      subtitle="Kết nối với người có kỹ năng bạn muốn học."
    >
      <Input
        label={
          tab === "Yêu cầu học"
            ? "Từ khóa yêu cầu học"
            : "Tên người hoặc kỹ năng"
        }
        value={query}
        onChangeText={setQuery}
        maxLength={tab === "Yêu cầu học" ? 120 : 254}
      />
      <ChoiceGroup
        label="Tìm trong"
        options={["Người chia sẻ", "Yêu cầu học"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Người chia sẻ" ? (
        <>
          <Button variant="paper" onPress={() => setVerified((v) => !v)}>
            {verified ? "Đang lọc: đã xác minh" : "Chỉ kỹ năng đã xác minh"}
          </Button>
          {users.map((p) => (
            <Panel key={p.id} title={p.name}>
              <Avatar name={p.name} userId={p.id} size={48} />
              <Copy>
                {p.skills
                  .map(
                    (s) =>
                      `${s.name}${s.verified ? " · đã xác minh" : " · chưa xác minh"}`,
                  )
                  .join("\n")}
              </Copy>
              <RouteButton secondary href={`/user/${p.id}`}>
                Xem hồ sơ
              </RouteButton>
            </Panel>
          ))}
          {!users.length && (
            <EmptyState
              title="Không tìm thấy người chia sẻ"
              description="Thử kỹ năng khác hoặc tắt bộ lọc xác minh."
            />
          )}
        </>
      ) : (
        <>
          <Copy>Tìm theo tiêu đề, mô tả hoặc mục tiêu học tập.</Copy>
          <RouteButton
            href={{
              pathname: "/discover",
              params: { query: query.normalize("NFKC").trim() },
            }}
          >
            Tìm yêu cầu học
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
