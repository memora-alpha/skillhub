import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { InfoModal } from "@/components/InfoModal";
import { FormNotice } from "@/components/FormNotice";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { SkillCard } from "../components/SkillCard";
import { SkillDetailActions } from "../components/SkillDetailActions";
import { SkillAction } from "../components/SkillAction";
import { QueryFeedback } from "../components/QueryFeedback";
import { VerificationHistory } from "../components/VerificationHistory";
import { useOwnSkill, validId } from "../hooks/use-skill-queries";
import { useSkillAction } from "../hooks/use-skill-action";
import { useSkills } from "../context/SkillsProvider";
export function SkillDetailScreen({
  sharingSkillId,
}: {
  sharingSkillId?: string | string[];
}) {
  const id = validId(sharingSkillId);
  const query = useOwnSkill(id);
  const { api, refresh, forgetSkill } = useSkills();
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
        header={(waiting) => (
          <View style={{ gap: 12 }}>
            <View style={skillStyles.row}>
              <Text style={[skillStyles.caption, { flex: 1 }]}>
                Thông tin kỹ năng
              </Text>
              <SkillAction
                label="Làm mới"
                icon="clock"
                disabled={action.pending || query.isFetching}
                onPress={() => {
                  if (!action.locked()) void refresh();
                }}
              />
            </View>
            <SkillCard skill={skill} detail />
            {!!query.error && <QueryFeedback query={query} />}
            <SkillDetailActions
              skill={skill}
              waiting={waiting}
              pending={action.pending}
              onEdit={() => {
                if (!action.locked())
                  router.push({
                    pathname: "/my-skills/[sharingSkillId]/edit",
                    params: { sharingSkillId: id },
                  });
              }}
              onVisibility={() => {
                const body = {
                  expectedVersion: skill.version,
                  isVisible: !skill.isVisible,
                };
                void action.run(`visibility:${id}`, body, (key) =>
                  api.update(id, body, key),
                );
              }}
              onVerify={() => {
                if (!action.locked() && !waiting)
                  router.push({
                    pathname: "/my-skills/[sharingSkillId]/verify",
                    params: { sharingSkillId: id },
                  });
              }}
              onDelete={() => {
                if (!action.locked()) setConfirm(true);
              }}
            />
          </View>
        )}
      />
      <InfoModal
        title={confirm ? "Xóa kỹ năng?" : null}
        onClose={() => setConfirm(false)}
        confirmLabel="Xóa kỹ năng"
        onConfirm={remove}
      >
        <Text style={skillStyles.body}>
          Kỹ năng sẽ bị gỡ khỏi hồ sơ và danh sách của bạn. Không thể khôi phục.
        </Text>
        <Button variant="secondary" onPress={() => setConfirm(false)}>
          Hủy
        </Button>
      </InfoModal>
    </SkillsLayout>
  );
}
