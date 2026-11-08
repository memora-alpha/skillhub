import type { ComponentProps } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";

export function ProfileAvatarLink({
  href,
  ...avatar
}: ComponentProps<typeof Avatar> & { href: Href }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Xem hồ sơ công khai của ${avatar.name}`}
        style={({ pressed }) => [styles.target, pressed && styles.pressed]}
      >
        <Avatar {...avatar} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  target: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  pressed: { opacity: 0.75 },
});
