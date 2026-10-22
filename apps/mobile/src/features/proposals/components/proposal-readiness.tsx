import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ConnectionFeedback } from "@/features/connections";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function ProposalReadiness({
  skill,
  teacher,
  duplicate,
  checking,
  error,
  retry,
}: Readonly<{
  skill: string;
  teacher?: {
    state: "eligible" | "missing" | "unverified";
    sharingSkillId?: string;
  };
  duplicate?: { id: string } | null;
  checking: boolean;
  error: unknown;
  retry: () => unknown;
}>) {
  const router = useRouter();
  const message = readinessMessage({
    checking,
    error: !!error,
    duplicate: !!duplicate,
    teacher,
    skill,
  });
  const ready =
    !checking &&
    !error &&
    !duplicate &&
    (!teacher || teacher.state === "eligible");
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <Icon
          name={ready ? "check-circle" : "alert"}
          size={17}
          color={ready ? colors.forest : colors.warning}
        />
        <Text
          accessibilityLiveRegion="polite"
          style={{
            ...typography.secondary,
            fontFamily: fonts.body,
            color: ready ? colors.forest : colors.body,
            flex: 1,
          }}
        >
          {message}
        </Text>
      </View>
      {!!error && <ConnectionFeedback error={error} retry={retry} />}
      {!checking && !error && duplicate && (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/proposals/[id]",
              params: { id: duplicate.id },
            })
          }
        >
          Xem đề xuất đang chờ
        </Button>
      )}
      {!checking && !error && !duplicate && teacher?.state === "missing" && (
        <Button
          variant="secondary"
          leadingIcon="plus"
          onPress={() => router.push("/my-skills/new")}
        >
          Thêm kỹ năng của bạn
        </Button>
      )}
      {!checking &&
        !error &&
        !duplicate &&
        teacher?.state === "unverified" &&
        teacher.sharingSkillId && (
          <Button
            variant="secondary"
            leadingIcon="shield"
            onPress={() =>
              router.push({
                pathname: "/my-skills/[sharingSkillId]/verify",
                params: { sharingSkillId: teacher.sharingSkillId! },
              })
            }
          >
            Xác minh kỹ năng
          </Button>
        )}
    </View>
  );
}

function readinessMessage(input: {
  checking: boolean;
  error: boolean;
  duplicate: boolean;
  teacher?: { state: "eligible" | "missing" | "unverified" };
  skill: string;
}) {
  if (input.checking) return "Đang kiểm tra điều kiện gửi đề xuất…";
  if (input.error)
    return "Chưa kiểm tra được điều kiện. Nội dung bạn nhập vẫn được giữ.";
  if (input.duplicate) return "Bạn đã có đề xuất đang chờ cho kết nối này.";
  if (input.teacher?.state === "missing")
    return `Bạn cần thêm kỹ năng ${input.skill} vào hồ sơ trước khi gửi.`;
  if (input.teacher?.state === "unverified")
    return `Bài này chỉ nhận người dạy có kỹ năng ${input.skill} đã xác minh. Kỹ năng của bạn chưa đạt điều kiện này.`;
  if (input.teacher)
    return `Bạn đã có kỹ năng ${input.skill} phù hợp để phản hồi bài này.`;
  return "Bạn đang mời người có kỹ năng này trao đổi. Chưa cần kỹ năng đối ứng khi gửi lời mời.";
}
