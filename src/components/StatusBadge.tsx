// 受信一覧の行の右に出す「未対応 / 返信済み」のバッジ。
// 文言・地の色・文字色を、相談の状態ごとに 1 つの表で持つ（行の読み上げの文言もこの表から引く）。

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "../theme";
import type { Consultation } from "../types";

type Status = Consultation["status"];

export const STATUS_BADGE: Record<
  Status,
  { label: string; bg: string; fg: string }
> = {
  waiting: { label: "未対応", bg: colors.dangerSoft, fg: colors.danger },
  answered: { label: "返信済み", bg: colors.safeSoft, fg: colors.safe },
};

interface Props {
  status: Status;
}

export default function StatusBadge({ status }: Props) {
  const { label, bg, fg } = STATUS_BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.tiny,
  },
  badgeText: { fontSize: font.small, fontWeight: "700" },
});
