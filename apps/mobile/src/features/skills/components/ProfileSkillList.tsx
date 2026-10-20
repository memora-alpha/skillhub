import { useRouter } from "expo-router";
import { skillLevelLabel } from "../utils/skill-level";
import {
  useOwnSkills,
  usePublicSkills,
  uniqueItems,
} from "../hooks/use-skill-queries";
import { QueryFeedback } from "./QueryFeedback";
import {
  ProfileSkillRow,
  ProfileSkillSection,
  ProfileSkillMore,
} from "./ProfileSkillRows";
import { useProfileSkillWindow } from "../hooks/use-profile-skill-window";
import { useSkills } from "../context/SkillsProvider";

export function OwnProfileSkillList() {
  const query = useOwnSkills();
  const router = useRouter();
  const items = uniqueItems(query.data?.pages);
  const preview = useProfileSkillWindow({
    count: items.length,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => query.fetchNextPage(),
  });
  return (
    <ProfileSkillSection onManage={() => router.push("/my-skills")}>
      {(!query.data || !!query.error || !items.length) && (
        <QueryFeedback
          query={query}
          empty={!items.length}
          emptyText="Chưa có kỹ năng chia sẻ."
        />
      )}
      {items.slice(0, preview.visible).map((skill) => (
        <ProfileSkillRow
          key={skill.id}
          name={skill.skill.name}
          level={skillLevelLabel(skill)}
          status={skill.verificationStatus}
          isVisible={skill.isVisible}
          onPress={() =>
            router.push({
              pathname: "/my-skills/[sharingSkillId]",
              params: { sharingSkillId: skill.id },
            })
          }
        />
      ))}
      {preview.hasMore && (
        <ProfileSkillMore
          busy={preview.busy || query.isFetchingNextPage}
          onPress={() => void preview.showMore()}
        />
      )}
    </ProfileSkillSection>
  );
}
export function PublicSelfSkillList() {
  const { userId } = useSkills();
  return <PublicProfileSkillList userId={userId} />;
}
export function PublicProfileSkillList({
  userId,
}: Readonly<{ userId: string }>) {
  const query = usePublicSkills(userId);
  const router = useRouter();
  const items = uniqueItems(query.data?.pages);
  const preview = useProfileSkillWindow({
    count: items.length,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => query.fetchNextPage(),
  });
  return (
    <ProfileSkillSection>
      {(!query.data || !!query.error || !items.length) && (
        <QueryFeedback
          query={query}
          empty={!items.length}
          emptyText="Chưa có kỹ năng hiển thị công khai."
        />
      )}
      {items.slice(0, preview.visible).map((skill) => (
        <ProfileSkillRow
          key={skill.id}
          name={skill.skill.name}
          level={skillLevelLabel(skill)}
          status={skill.verificationStatus}
          onPress={() =>
            router.push({
              pathname: "/public-skills/[userId]/[sharingSkillId]",
              params: { userId, sharingSkillId: skill.id },
            })
          }
        />
      ))}
      {preview.hasMore && (
        <ProfileSkillMore
          busy={preview.busy || query.isFetchingNextPage}
          onPress={() => void preview.showMore()}
        />
      )}
    </ProfileSkillSection>
  );
}
