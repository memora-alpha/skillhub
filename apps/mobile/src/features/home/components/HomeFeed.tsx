import { Pressable, Text, View } from "react-native";
import type { Href } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { avatarSizes } from "@/constants/theme";
import { ConversationRow } from "@/features/messages";
import { homeColors as colors } from "../constants/theme";
import type { HomeData } from "../hooks/use-home-data";
import { HomeSection, SectionHeading, homeStyles } from "./HomePrimitives";
import { HomeReadFeedback } from "./HomeReadFeedback";
import { styles } from "./HomeContent.styles";

type Props = Readonly<{ data: HomeData; onNavigate: (href: Href) => void }>;

export function HomeRequests({ data, onNavigate }: Props) {
  const { requests } = data;
  return (
    <HomeSection>
      <SectionHeading
        title="Yêu cầu học phù hợp"
        action="Khám phá"
        accent={colors.green}
        onPress={() => onNavigate("/discover")}
      />
      <HomeReadFeedback
        {...requests}
        hasData={requests.items.length > 0}
        retry={requests.refetch}
      >
        <View style={{ gap: 12 }}>
          {requests.items.length === 0 && (
            <View style={[styles.card, styles.course]}>
              <Text style={homeStyles.label}>Chưa có yêu cầu phù hợp</Text>
              <Text style={homeStyles.caption}>
                Bổ sung kỹ năng chia sẻ hoặc khám phá thêm yêu cầu học.
              </Text>
            </View>
          )}
          {requests.items.map((request) => (
            <Pressable
              key={request.id}
              accessibilityRole="button"
              accessibilityLabel={`Xem yêu cầu: ${request.title}`}
              onPress={() =>
                onNavigate({
                  pathname: "/request/[id]",
                  params: { id: request.id },
                })
              }
              style={({ pressed }) => [
                styles.card,
                styles.request,
                pressed && styles.pressed,
              ]}
            >
              <View style={[homeStyles.row, { gap: 8, flexWrap: "wrap" }]}>
                <View
                  style={[styles.match, { maxWidth: "100%", flexShrink: 1 }]}
                >
                  <Text style={styles.matchLabel} numberOfLines={1}>
                    {request.skill.name}
                  </Text>
                </View>
                <View style={styles.budgetBadge}>
                  <Text style={styles.budget}>
                    {request.desiredCreditPerHour
                      ? `${request.desiredCreditPerHour} CR/giờ`
                      : "Chưa đặt Credit"}
                  </Text>
                </View>
              </View>
              <Text style={styles.requestTitle} numberOfLines={2}>
                {request.title}
              </Text>
              <View style={styles.requestPerson}>
                <Avatar
                  name={request.owner.displayName}
                  userId={request.owner.id}
                  size={avatarSizes.inline}
                />
                <Text style={[homeStyles.caption, { flex: 1 }]}>
                  {request.owner.displayName}
                </Text>
                <View style={styles.connectButton}>
                  <Text style={styles.connectLabel}>Xem chi tiết</Text>
                  <Icon name="chevron" size={14} color={colors.orange} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </HomeReadFeedback>
    </HomeSection>
  );
}

export function HomeMessages({ data, onNavigate }: Props) {
  const { messages } = data;
  return (
    <HomeSection>
      <SectionHeading
        title="Trò chuyện của bạn"
        action="Tất cả"
        accent={colors.blue}
        onPress={() => onNavigate("/messages")}
      />
      <HomeReadFeedback
        {...messages}
        hasData={messages.items.length > 0}
        retry={messages.refetch}
      >
        <View style={{ gap: 12 }}>
          {messages.items.length === 0 && (
            <View style={[styles.card, styles.course]}>
              <Text style={homeStyles.label}>Chưa có cuộc trò chuyện</Text>
              <Text style={homeStyles.caption}>
                Kết nối qua kỹ năng hoặc yêu cầu học để bắt đầu trao đổi.
              </Text>
            </View>
          )}
          {messages.items.map((item) => (
            <ConversationRow key={item.conversation.id} item={item} />
          ))}
        </View>
      </HomeReadFeedback>
    </HomeSection>
  );
}
