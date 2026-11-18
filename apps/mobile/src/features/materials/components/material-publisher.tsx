import { Text, View } from "react-native";
import { ProfileAvatarLink } from "@/components/profile-avatar-link";
import { useParticipantProfile, useCatalogName } from "@/features/connections";
import type { ApiMaterial } from "../api/material-contracts";
import { materialStyles as styles } from "./material.styles";

export function MaterialPublisher({
  material,
}: Readonly<{ material: ApiMaterial }>) {
  const profile = useParticipantProfile(material.ownerId);
  const skill = useCatalogName(material.skillId);
  return (
    <View style={styles.section}>
      <View style={styles.inline}>
        <ProfileAvatarLink
          href={`/profiles/${material.ownerId}`}
          name={profile.data?.fullName ?? "Người chia sẻ"}
          sourceUri={profile.data?.avatarUrl ?? null}
          userId={material.ownerId}
          size={36}
        />
        <View style={styles.grow}>
          <Text style={styles.caption}>Người chia sẻ</Text>
          <Text style={styles.title}>
            {profile.data?.fullName ?? "Thông tin chưa khả dụng"}
          </Text>
        </View>
      </View>
      {!!skill.data && <Text style={styles.meta}>Kỹ năng: {skill.data}</Text>}
    </View>
  );
}
