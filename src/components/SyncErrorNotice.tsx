// 送れなかったときの知らせ（store の syncError をそのまま渡す）。
// 親に文字入力を求めず、電話で確かめてもらうための帯。画面の本文の最上部に置く。
// message が無いときは何も描かない（置いた画面の見た目は今のまま）。

import React, { useEffect } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, font, lineHeight, radius, space } from "../theme";

interface Props {
  message?: string;
}

export default function SyncErrorNotice({ message }: Props) {
  // iOS / Android は画面の変化を自動では読み上げないので、出たときに読み上げに通知する。
  // （Web は下の role="alert" で読み上げられる）
  useEffect(() => {
    if (message && Platform.OS !== "web")
      AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={styles.band}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    alignSelf: "stretch",
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  text: {
    fontSize: font.big,
    fontWeight: "800",
    color: colors.onColor,
    textAlign: "center",
    lineHeight: lineHeight.big,
  },
});
