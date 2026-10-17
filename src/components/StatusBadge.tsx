// 受信一覧の行の右に出す「未対応 / 返信済み」のバッジ。
// 文言・絵・地の色・文字色を、相談の状態ごとに 1 つの表で持つ（行の読み上げの文言もこの表から引く）。

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, layout, radius, space } from "../theme";
import type { Consultation, IconName } from "../types";
import Icon from "./icons/Icon";

type Status = Consultation["status"];

export const STATUS_BADGE: Record<
  Status,
  { label: string; icon: IconName; bg: string; fg: string }
> = {
  waiting: {
    label: "未対応",
    icon: "status-waiting",
    bg: colors.dangerSoft,
    fg: colors.danger,
  },
  answered: {
    label: "返信済み",
    icon: "status-answered",
    bg: colors.safeSoft,
    fg: colors.safe,
  },
};

interface Props {
  status: Status;
}

export default function StatusBadge({ status }: Props) {
  const { label, icon, bg, fg } = STATUS_BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon name={icon} size={20} />
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...layout.centerRow,
    gap: space.xs,
    flexShrink: 0,
    borderRadius: radius.pill,
    paddingLeft: space.s,
    paddingRight: space.sm,
    paddingVertical: space.xs,
  },
  badgeText: { fontSize: font.small, fontWeight: "700" },
});
