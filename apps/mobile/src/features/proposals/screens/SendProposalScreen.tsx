import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { colors, fonts, typography, signedInChrome } from "@/constants/theme";
import { learningRequests } from "@/features/discovery";
import { publicProfiles } from "@/features/profile";
import { useAuthSession } from "@/features/auth";
import { useMockProposals } from "../context/MockProposals";
import { demoTeachingSkills } from "../mocks/proposals";
import { proposalFormSchema } from "../schemas/proposal-form";
import {
  readRequestProposalPreview,
  type RequestProposalPreviewParams,
} from "../utils/request-proposal-preview";

export function SendProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<
    RequestProposalPreviewParams & {
      userId?: string;
    }
  >();
  const { session } = useAuthSession();
  const { proposals, submit } = useMockProposals();
  const preview = readRequestProposalPreview(params);
  const request =
    preview ?? learningRequests.find((item) => item.id === params.requestId);
  const profile = publicProfiles.find(
    (item) => item.id === (request?.userId ?? params.userId),
  );
  const targetId = request?.userId ?? profile?.id;
  const targetName = request?.user ?? profile?.name;
  const skills = preview
    ? preview.teachingSkills
    : request
      ? demoTeachingSkills.filter((skill) =>
          request.tags.some((tag) => tag.toLowerCase() === skill.id),
        )
      : demoTeachingSkills;
  const [selectedSkillId, setSkillId] = useState(skills[0]?.id ?? "");
  const skillId = preview?.teachingSkills[0]?.id ?? selectedSkillId;
  const [message, setMessage] = useState("");
  const [credit, setCredit] = useState(request?.budget.split(" ")[0] ?? "50");
  const [sessions, setSessions] = useState(String(request?.sessions ?? 4));
  const [schedule, setSchedule] = useState("Tối Thứ 5 và Thứ 7");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const duplicate = proposals.some(
    (item) =>
      item.direction === "sent" &&
      item.status === "PENDING" &&
      item.partnerId === targetId &&
      item.requestId === request?.id,
  );
  const back: Href = preview
    ? { pathname: "/request/[id]", params: { id: preview.sourceRequestId } }
    : request
      ? { pathname: "/explore/requests/[id]", params: { id: request.id } }
      : profile
        ? { pathname: "/user/[id]", params: { id: profile.id } }
        : "/discover";
  const send = () => {
    const next: Record<string, string> = {};
    const parsed = proposalFormSchema.safeParse({
      message,
      credit,
      sessions,
      schedule,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message;
    if (!skills.some((skill) => skill.id === skillId))
      next.skill = "Chọn kỹ năng phù hợp.";
    if (!targetId || targetId === session?.userId)
      next.form = "Bạn không thể gửi đề xuất cho chính mình.";
    setErrors(next);
    if (Object.keys(next).length || !targetId || !targetName) return;
    const chosen = skills.find((skill) => skill.id === skillId)!;
    const saved = submit({
      sourceType: request ? "LEARNING_REQUEST" : "DIRECT_SEARCH",
      requestId: request?.id,
      requestTitle: request?.title ?? `Lời mời trao đổi với ${targetName}`,
      partnerId: targetId,
      partner: targetName,
      skill: chosen.name,
      message: message.trim(),
      credit: credit.trim(),
      sessions: Number(sessions),
      schedule: schedule.trim(),
    });
    if (!saved) {
      setErrors({
        form: "Đã có đề xuất đang chờ phản hồi. Bạn có thể xem hoặc rút đề xuất trong danh sách Đã gửi.",
      });
      return;
    }
    Keyboard.dismiss();
    setSent(true);
  };
  return (
    <AppScreenLayout
      title={request ? "Gửi đề xuất" : "Lời mời trao đổi"}
      selected="Khám phá"
      back={{ href: back, label: "Quay lại" }}
    >
      {() =>
        !targetId || !targetName || (!!params.requestId && !request) ? (
          <EmptyState
            title="Không tìm thấy yêu cầu"
            description="Chọn một yêu cầu học hoặc hồ sơ để gửi đề xuất."
            action="Khám phá"
            onAction={() => router.dismissTo("/discover")}
          />
        ) : (
          <KeyboardFormScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {sent ? (
              <>
                <FormNotice tone="success">Đề xuất mẫu đã gửi!</FormNotice>
                <Text style={styles.body}>
                  Đề xuất chỉ lưu trong phiên hiện tại, chưa gửi tới người nhận.
                  Chat mẫu chỉ mở sau khi đề xuất được chấp nhận trong bản mẫu.
                </Text>
                <Button
                  onPress={() =>
                    router.replace({
                      pathname: "/proposals",
                      params: { tab: "sent" },
                    })
                  }
                >
                  Xem đề xuất đã gửi
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => router.dismissTo("/discover")}
                >
                  Tiếp tục khám phá
                </Button>
              </>
            ) : (
              <>
                {preview && (
                  <FormNotice tone="info">
                    Bản xem thử · Nội dung yêu cầu được dùng để minh họa. Kỹ
                    năng, Credit, số buổi và lịch bên dưới là gợi ý mẫu; gửi chỉ
                    lưu trong phiên, chưa gửi tới người nhận qua API.
                  </FormNotice>
                )}
                <Text accessibilityRole="header" style={styles.title}>
                  Cho {targetName} biết bạn có thể chia sẻ gì
                </Text>
                <Text style={styles.body}>
                  Giới thiệu kinh nghiệm, cách hướng dẫn và kết quả bạn muốn
                  cùng đạt được.
                </Text>
                <View style={styles.card}>
                  <Text style={styles.heading}>
                    {request?.title ?? "Trao đổi trực tiếp từ hồ sơ"}
                  </Text>
                  <View style={styles.row}>
                    <Avatar name={targetName} userId={targetId} size={28} />
                    <Text style={styles.caption}>
                      {targetName}
                      {request && !preview
                        ? ` · ${request.sessions} buổi dự kiến`
                        : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.label}>Kỹ năng bạn có thể chia sẻ</Text>
                  <View style={styles.skillChoices}>
                    {skills.map((skill) => (
                      <Pressable
                        key={skill.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: skillId === skill.id }}
                        onPress={() => setSkillId(skill.id)}
                        style={[
                          styles.skill,
                          skillId === skill.id && styles.selectedSkill,
                        ]}
                      >
                        <Text style={styles.label}>{skill.name}</Text>
                        <Badge
                          label={
                            skill.verified ? "Đã xác minh" : "Chưa xác minh"
                          }
                          variant={skill.verified ? "sage" : "default"}
                        />
                      </Pressable>
                    ))}
                  </View>
                  {!skills.length && (
                    <FormNotice tone="error">
                      Hồ sơ mẫu của bạn chưa có kỹ năng phù hợp với yêu cầu này.
                    </FormNotice>
                  )}
                  {errors.form && (
                    <FormNotice tone="error">{errors.form}</FormNotice>
                  )}
                  <Input
                    label="Bạn sẽ giúp người học như thế nào?"
                    required
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    maxLength={1000}
                    placeholder="Chia sẻ kinh nghiệm, cách dạy và mục tiêu..."
                    error={errors.message}
                    hint={`${message.length}/1.000 ký tự`}
                  />
                  <Input
                    label="Credit gợi ý cho toàn lộ trình"
                    required
                    value={credit}
                    onChangeText={setCredit}
                    keyboardType="decimal-pad"
                    error={errors.credit}
                    hint="Mức gợi ý; loại thỏa thuận và Credit chính thức sẽ được chốt trong Chat."
                  />
                  <Input
                    label="Số buổi dự kiến"
                    required
                    value={sessions}
                    onChangeText={setSessions}
                    keyboardType="number-pad"
                    error={errors.sessions}
                  />
                  <Input
                    label="Khung giờ đề xuất"
                    value={schedule}
                    onChangeText={setSchedule}
                    placeholder="Ví dụ: buổi tối hoặc cuối tuần"
                    hint="Khung giờ tham khảo, chưa phải lịch được xác nhận."
                  />
                </View>
                <Text style={styles.body}>
                  Gửi đề xuất chưa mở Chat, chưa tạo buổi học và chưa tạm giữ
                  Credit.
                </Text>
                {duplicate && (
                  <Text accessibilityRole="alert" style={styles.caption}>
                    Bạn đã có đề xuất đang chờ phản hồi cho yêu cầu này.
                  </Text>
                )}
                <Button
                  disabled={
                    !skills.length || duplicate || targetId === session?.userId
                  }
                  onPress={send}
                >
                  Gửi đề xuất
                </Button>
                {duplicate && (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/proposals",
                        params: { tab: "sent" },
                      })
                    }
                  >
                    Xem đề xuất đã gửi
                  </Button>
                )}
                <Text style={styles.caption}>
                  Bản mẫu · Đề xuất chỉ lưu trong phiên hiện tại.
                </Text>
              </>
            )}
          </KeyboardFormScrollView>
        )
      }
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: { fontFamily: fonts.bold, ...typography.title, color: colors.ink },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  label: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
  card: {
    padding: 16,
    gap: 16,
    backgroundColor: signedInChrome.surface,
    borderRadius: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  skillChoices: { gap: 8 },
  skill: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
  },
  selectedSkill: {
    borderColor: colors.sage,
    backgroundColor: colors.sageLight,
  },
});
