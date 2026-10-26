import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { Text, View } from "react-native";
import type { ComponentType } from "react";
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
import { evidenceTime } from "../utils/evidence-time";
export function VerificationHistory<T extends object>({
  id,
  header: Header,
  headerProps,
  pending = false,
  locked,
  onRefresh,
}: Readonly<{
  id: string;
  header: ComponentType<T & { waiting: boolean }>;
  headerProps: T;
  pending?: boolean;
  locked?: () => boolean;
  onRefresh?: () => void;
}>) {
  const query = useVerificationHistory(id);
  const router = useRouter();
  const { submittedVerifications } = useSkills();
  const items = query.readDenied
    ? []
    : verificationItems(
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
          {!query.readDenied && (
            <Header
              {...headerProps}
              waiting={items.some((item) => item.status === "PENDING")}
            />
          )}
          <Text style={skillStyles.heading}>Lịch sử xác minh</Text>
          <QueryFeedback
            loadingPresentation="placeholder"
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
            Gửi: {evidenceTime(item.submittedAt)}
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
              if (locked?.() || !query.canRead()) return;
              router.push({
                pathname:
                  "/my-skills/[sharingSkillId]/verifications/[verificationId]",
                params: { sharingSkillId: id, verificationId: item.id },
              });
            }}
          />
        </View>
      )}
      ListFooterComponent={
        query.data ? <PageFooter query={query} /> : undefined
      }
    />
  );
}
