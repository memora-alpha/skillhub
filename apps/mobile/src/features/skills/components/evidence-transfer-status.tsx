import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { appColors, fonts } from "@/constants/theme";
import type { OwnSkill } from "../types/skills";
import { useEvidenceTransfer } from "../hooks/use-evidence-transfer";
import { useSkills } from "../context/SkillsProvider";
import { hasPendingVerification } from "../utils/verification-state";
import { useToast } from "@/providers/ToastProvider";
import { skillStyles } from "./SkillsLayout";
import { useRouter } from "expo-router";

export function EvidenceTransferStatus({
  skill,
}: Readonly<{ skill: OwnSkill }>) {
  const task = useEvidenceTransfer(skill.id);
  const { transfers, verificationDrafts, privateReads, scope } = useSkills();
  const router = useRouter();
  const { showToast } = useToast();
  const waiting = task?.state === "PENDING" || hasPendingVerification(skill);
  const sending = task?.state === "SENDING";
  const checking = task?.state === "WAITING_SCAN" && !waiting;
  const failed = task?.state === "FAILED" && !waiting;
  const retry = () => {
    if (
      privateReads.denied([...scope, "detail", skill.id]) ||
      privateReads.denied([...scope, "history", skill.id])
    )
      return;
    const edit = () =>
      router.push({
        pathname: "/my-skills/[sharingSkillId]/verify",
        params: { sharingSkillId: skill.id },
      });
    if (!verificationDrafts.get(skill.id)?.files.length) {
      edit();
      return;
    }
    try {
      if (transfers.start(skill.id)) showToast("Đang gửi bằng chứng…", "info");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Kiểm tra lại bằng chứng.",
        "error",
      );
      edit();
    }
  };
  if (
    !sending &&
    !checking &&
    !failed &&
    (!waiting || skill.verificationStatus === "PENDING")
  )
    return null;
  let label = "Chờ duyệt";
  if (sending) label = task.progress ?? "Đang chuẩn bị bằng chứng…";
  else if (checking) label = "Đã tải lên · Chờ kiểm tra bằng chứng";
  else if (failed) label = "Gửi chưa hoàn tất";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {sending && (
        <ActivityIndicator
          size="small"
          color={appColors.primary}
          accessibilityLabel={label}
        />
      )}
      <Text
        accessibilityLiveRegion="polite"
        style={[
          skillStyles.caption,
          { color: failed ? appColors.error : appColors.muted, flexShrink: 1 },
        ]}
      >
        {label}
      </Text>
      {(failed || checking) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${checking ? "Kiểm tra lại" : "Thử lại"} bằng chứng: ${skill.skill.name}`}
          onPress={retry}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <Text
            style={{ fontFamily: fonts.semibold, color: appColors.primary }}
          >
            {checking ? "Kiểm tra lại" : "Thử lại"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
