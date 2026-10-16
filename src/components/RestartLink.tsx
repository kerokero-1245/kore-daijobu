// 開発用の小さなリンク「最初からやり直す」。サインアウトして新しい匿名ユーザーで役割の選択から始める。
// ペアリングの画面の下にだけ置く（親の日常の画面には出さない）。

import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useSession } from "../data/session";
import { colors, space, textStyle } from "../theme";

export default function RestartLink() {
  const { restart } = useSession();
  return (
    <Pressable
      onPress={() => void restart()}
      accessibilityRole="link"
      style={styles.link}
    >
      <Text style={styles.text}>最初からやり直す（開発用）</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: "center", padding: space.sm, marginTop: space.lg },
  text: {
    ...textStyle.caption,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
