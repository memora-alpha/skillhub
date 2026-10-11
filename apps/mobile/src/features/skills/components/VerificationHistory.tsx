import { FlatList, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import {
  useVerificationHistory,
  uniqueItems,
} from "../hooks/use-skill-queries";
import { QueryFeedback, PageFooter } from "./QueryFeedback";
import { skillStyles } from "./SkillsLayout";
import { decisionLabels } from "../types/skills";
import { SkillAction } from "./SkillAction";
import { SubmittedEvidence } from "./SubmittedEvidence";
import { useSkills } from "../context/SkillsProvider";
import { verificationItems } from "../utils/verification-state";
export function VerificationHistory({
  id,
  header,
  pending = false,
  locked,
  onRefresh,
}: {
  id: string;
  header: ReactNode | ((waiting: boolean) => ReactNode);
  pending?: boolean;
  locked?: () => boolean;
  onRefresh?: () => void;
}) {
  const query = useVerificationHistory(id);
  const router = useRouter();
  const { submittedVerifications } = useSkills();
  const items = verificationItems(
    uniqueItems(query.data?.pages),
    submittedVerifications.get(id),
  );
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={skillStyles.content}
      refreshing={query.isRefetching}
      onRefresh={onRefresh ?? (() => void query.refetch())}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 16 }}>
          {typeof header === "function"
            ? header(items.some((item) => item.status === "PENDING"))
            : header}
          <Text style={skillStyles.heading}>Lịch sử xác minh</Text>
          <QueryFeedback
            query={query}
            empty={!items.length}
            emptyText="Chưa gửi yêu cầu xác minh."
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={[skillStyles.card, { marginBottom: 12 }]}>
          <Text style={skillStyles.heading}>{decisionLabels[item.status]}</Text>
          <Text style={skillStyles.caption}>
            {new Date(item.submittedAt).toLocaleString("vi-VN")}
          </Text>
          {item.rejectReason && (
            <Text style={skillStyles.body}>Lý do: {item.rejectReason}</Text>
          )}
          {item.files.map((file, index) => (
            <SubmittedEvidence
              key={file.id}
              id={id}
              file={file}
              index={index}
              compact
            />
          ))}
          <SkillAction
            label="Xem yêu cầu"
            icon="arrow"
            disabled={pending}
            onPress={() => {
              if (locked?.()) return;
              router.push({
                pathname:
                  "/my-skills/[sharingSkillId]/verifications/[verificationId]",
                params: { sharingSkillId: id, verificationId: item.id },
              });
            }}
          />
        </View>
      )}
      ListFooterComponent={query.data ? <PageFooter query={query} /> : null}
    />
  );
}
