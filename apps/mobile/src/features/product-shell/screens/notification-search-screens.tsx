import { useState } from "react";
import { Input } from "@/components/Input";
import { ChoiceGroup } from "@/components/choice-group";
import { FeaturePage, Copy, RouteButton } from "@/components/feature-page";
import { SkillSharersSearch } from "@/features/skills";

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Người chia sẻ");
  return (
    <FeaturePage
      title="Tìm kiếm"
      back="/home"
      demo={false}
      subtitle="Kết nối với người có kỹ năng bạn muốn học."
    >
      <ChoiceGroup
        label="Tìm trong"
        options={["Người chia sẻ", "Yêu cầu học"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Người chia sẻ" ? (
        <SkillSharersSearch />
      ) : (
        <>
          <Input
            label="Từ khóa yêu cầu học"
            value={query}
            onChangeText={setQuery}
            maxLength={120}
          />
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
