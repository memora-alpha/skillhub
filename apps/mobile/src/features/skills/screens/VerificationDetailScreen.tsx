import { Text, View } from "react-native";
import * as Linking from "expo-linking";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { QueryFeedback } from "../components/QueryFeedback";
import {
  useOwnSkill,
  useVerification,
  validId,
} from "../hooks/use-skill-queries";
import { useSkills } from "../context/SkillsProvider";
import { useSkillAction } from "../hooks/use-skill-action";
import { decisionLabels } from "../types/skills";
import { SubmittedEvidence } from "../components/SubmittedEvidence";
import { evidenceTime } from "../utils/evidence-time";
export function VerificationDetailScreen({
  sharingSkillId,
  verificationId,
}: {
  sharingSkillId?: string | string[];
  verificationId?: string | string[];
}) {
  const id = validId(sharingSkillId);
  const batchId = validId(verificationId);
  const owner = useOwnSkill(id);
  const available = !!owner.data && !owner.data.archivedAt;
  const query = useVerification(available ? id : null, batchId);
  const { api, refresh } = useSkills();
  const action = useSkillAction();
  if (!id || !batchId || owner.data === null || owner.data?.archivedAt)
    return (
      <SkillsLayout title="Yêu cầu xác minh">
        <FormNotice tone="info">Yêu cầu không khả dụng.</FormNotice>
      </SkillsLayout>
    );
  if (!available)
    return (
      <SkillsLayout title="Yêu cầu xác minh">
        <QueryFeedback query={owner} />
      </SkillsLayout>
    );
  const openFile = (evidenceId: string) =>
    void action.run(
      `download:${evidenceId}`,
      null,
      async () => {
        const download = await api.download(id, evidenceId);
        if (!action.current()) return;
        if (Date.parse(download.expiresAt) <= Date.now())
          throw new Error("expired");
        await Linking.openURL(download.url);
      },
      undefined,
      false,
    );
  const batch = query.data;
  return (
    <SkillsLayout title="Yêu cầu xác minh" locked={action.locked}>
      <QueryFeedback query={query} />
      {batch && (
        <>
          <View style={skillStyles.card}>
            <Text style={skillStyles.heading}>
              {decisionLabels[batch.status]}
            </Text>
            <Text style={skillStyles.body}>
              Gửi: {evidenceTime(batch.submittedAt)}
            </Text>
            {batch.reviewedAt && (
              <Text style={skillStyles.body}>
                Xét duyệt: {evidenceTime(batch.reviewedAt)}
              </Text>
            )}
            {batch.rejectReason && (
              <Text selectable style={skillStyles.body}>
                Lý do từ chối: {batch.rejectReason}
              </Text>
            )}
            {batch.note && (
              <Text selectable style={skillStyles.body}>
                Ghi chú: {batch.note}
              </Text>
            )}
          </View>
          {batch.files.map((file, index) => (
            <View key={file.id} style={skillStyles.card}>
              <SubmittedEvidence id={id} file={file} index={index} />
              <Text style={skillStyles.caption}>
                {decisionLabels[file.approvalStatus]}
              </Text>
              {file.description && (
                <Text selectable style={skillStyles.body}>
                  {file.description}
                </Text>
              )}
              {file.rejectReason && (
                <Text style={skillStyles.body}>
                  Lý do từ chối: {file.rejectReason}
                </Text>
              )}
              {file.revokedReason && (
                <Text style={skillStyles.body}>
                  Lý do thu hồi: {file.revokedReason}
                </Text>
              )}
              <Button
                variant="secondary"
                disabled={action.pending}
                onPress={() => openFile(file.id)}
              >
                Mở file riêng tư
              </Button>
            </View>
          ))}
        </>
      )}
      <Button
        variant="secondary"
        disabled={query.isFetching || action.pending}
        onPress={() => void refresh()}
      >
        Kiểm tra kết quả mới nhất
      </Button>
    </SkillsLayout>
  );
}
