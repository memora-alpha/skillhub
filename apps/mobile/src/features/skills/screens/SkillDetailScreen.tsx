import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { InfoModal } from "@/components/InfoModal";
import { FormNotice } from "@/components/FormNotice";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { SkillDetailHeader } from "../components/SkillDetailHeader";
import { QueryFeedback } from "../components/QueryFeedback";
import { VerificationHistory } from "../components/VerificationHistory";
import { useOwnSkill, validId } from "../hooks/use-skill-queries";
import { useSkillAction } from "../hooks/use-skill-action";
import { useSkills } from "../context/SkillsProvider";
export function SkillDetailScreen({
  sharingSkillId,
}: Readonly<{
  sharingSkillId?: string | string[];
}>) {
  const id = validId(sharingSkillId);
  const query = useOwnSkill(id);
  const { api, refresh, forgetSkill, rememberSkill } = useSkills();
  const action = useSkillAction();
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const skill = query.data;
  if (!id || skill === null || skill?.archivedAt)
    return (
      <SkillsLayout title="Kỹ năng">
        <FormNotice tone="info">Kỹ năng không khả dụng.</FormNotice>
      </SkillsLayout>
    );
  if (!skill)
    return (
      <SkillsLayout title="Kỹ năng">
        <QueryFeedback query={query} />
      </SkillsLayout>
    );
  const remove = () => {
    setConfirm(false);
    void action.run(
      `archive:${id}`,
      { expectedVersion: skill.version },
      async (key) => {
        const saved = await api.archive(id, skill.version, key);
        if (action.current()) await forgetSkill(id);
        return saved;
      },
      () => router.dismissTo("/my-skills"),
      true,
      "Đã xóa kỹ năng.",
    );
  };
  return (
    <SkillsLayout
      title="Chi tiết kỹ năng"
      scroll={false}
      locked={action.locked}
    >
      <VerificationHistory
        id={id}
        pending={action.pending}
        locked={action.locked}
        onRefresh={() => {
          if (!action.locked()) void refresh();
        }}
        header={SkillDetailHeader}
        headerProps={{
          skill,
          query,
          pending: action.pending,
          onRefresh: () => {
            if (!action.locked()) void refresh();
          },
          onEdit: () => {
            if (!action.locked())
              router.push({
                pathname: "/my-skills/[sharingSkillId]/edit",
                params: { sharingSkillId: id },
              });
          },
          onVisibility: () => {
            const body = {
              expectedVersion: skill.version,
              isVisible: !skill.isVisible,
            };
            void action.run(`visibility:${id}`, body, async (key) => {
              const saved = await api.update(id, body, key);
              if (action.current()) await rememberSkill(saved);
              return saved;
            });
          },
          onVerify: (waiting: boolean) => {
            if (!action.locked() && !waiting)
              router.push({
                pathname: "/my-skills/[sharingSkillId]/verify",
                params: { sharingSkillId: id },
              });
          },
          onDelete: () => {
            if (!action.locked()) setConfirm(true);
          },
        }}
      />
      <InfoModal
        title={confirm ? "Xóa kỹ năng?" : null}
        onClose={() => setConfirm(false)}
        confirmLabel="Xóa kỹ năng"
        onConfirm={remove}
      >
        <Text style={skillStyles.body}>
          Kỹ năng sẽ bị gỡ khỏi hồ sơ và danh sách của bạn. Lịch sử xác minh vẫn
          được hệ thống lưu giữ.
        </Text>
        <Button variant="secondary" onPress={() => setConfirm(false)}>
          Hủy
        </Button>
      </InfoModal>
    </SkillsLayout>
  );
}
