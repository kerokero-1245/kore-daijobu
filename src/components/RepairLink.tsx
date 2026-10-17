// 親のホームと子の受信一覧の一番下に置く小さなリンク「つなぎ直す」。
// スマホを替えたときなどに、もう一度番号で結び直すための入口（押すとサインアウトして、
// 新しい匿名ユーザーで役割の選択から始める。前の相談は見えなくなる）。
// 押しまちがいで消えないよう、押すと 1 回だけ確かめる（Web でも同じ動きにするため、画面の中で聞く）。

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "../data/session";
import { colors, lineHeight, space, textStyle } from "../theme";

export default function RepairLink() {
  const { restart } = useSession();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Pressable
        onPress={() => setAsking(true)}
        accessibilityRole="link"
        style={styles.link}
      >
        <Text style={styles.text}>つなぎ直す</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.ask}>
      <Text style={styles.question}>
        つなぎ直しますか？{"\n"}
        両方のスマホで「つなぎ直す」を押して、もう一度番号でつなぎます。前の相談は見えなくなります。
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => setAsking(false)}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text style={styles.text}>やめる</Text>
        </Pressable>
        <Pressable
          onPress={() => void restart()}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text style={[styles.text, styles.danger]}>つなぎ直す</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: "center", padding: space.sm, marginTop: space.lg },
  text: {
    ...textStyle.caption,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  danger: { color: colors.danger },
  ask: { marginTop: space.lg, alignItems: "center" },
  question: {
    ...textStyle.caption,
    textAlign: "center",
    lineHeight: lineHeight.body,
  },
  row: { flexDirection: "row", gap: space.lg },
});
