// 高齢者でも押しやすい大きなボタン。タップ領域と文字を大きく取る。
// 見た目は variant で選ぶ（色の組は theme.ts の tone の 1 か所）:
//   card（既定）… 白いカード（枠線と下の影）/ primary … 橙の地・こげ茶の文字・濃い橙の縁 /
//   verdict … 判定の色地・白い文字（verdict を渡す）
// 絵（icon）を渡すと、丸い台に載せて文字の左に置き、文字は左寄せにする。絵が無く sub も無いときは文字を中央に置く。
// center を付けると、絵があっても台なしの絵と文字を中央に並べる（「つなぐ」）。
// tall は役割の選択のような、絵と 2 行の文字を載せる背の高いボタン。
// disabled のときは押せず、薄く出す（読み上げにも「使用不可」と伝える）。

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  borderWidth,
  colors,
  font,
  lift,
  liftShadow,
  lineHeight,
  pressedOpacity,
  radius,
  space,
  tone as tones,
  type Tone,
} from "../theme";
import type { IconName, Verdict } from "../types";
import Icon from "./icons/Icon";
import IconDisc from "./icons/IconDisc";

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disc?: string; // 絵の台の色（既定は variant ごと）
  sub?: string;
  tall?: boolean;
  minHeight?: number; // 背の低い画面で詰めるとき（既定 88）
  center?: boolean; // 絵があっても文字を中央に置く（絵は台なしで文字の左）
  disabled?: boolean;
} & (
  | { variant?: "card" }
  | { variant: "primary" }
  | { variant: "verdict"; verdict: Verdict }
);

// 台なしで文字の左に置く絵の大きさ。
const PLAIN_ICON = 34;

// 押せないときの濃さ。
const DISABLED_OPACITY = 0.4;

// variant ごとの色の組と、絵の台の既定の色。
function look(props: Props): { tone: Tone; disc: string } {
  switch (props.variant) {
    case "primary":
      return { tone: "primary", disc: colors.surface };
    case "verdict":
      return { tone: props.verdict, disc: colors.onColor };
    default:
      return { tone: "card", disc: colors.orangeSoft };
  }
}

// 台の直径と絵の大きさ（背の高いボタン / 判定の色地 / ふつう）。
const DISC = {
  tall: { size: 64, icon: 48 },
  verdict: { size: 44, icon: 34 },
  normal: { size: 52, icon: 36 },
};

export default function BigButton(props: Props) {
  const { label, onPress, icon, sub, tall = false, disabled = false } = props;
  const l = look(props);
  const t = tones[l.tone];
  const verdict = props.variant === "verdict";
  const disc = tall ? DISC.tall : verdict ? DISC.verdict : DISC.normal;
  const centered = props.center ?? (!icon && !sub);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        tall && styles.tall,
        {
          backgroundColor: t.bg,
          borderColor: t.edge,
          ...(props.minHeight ? { minHeight: props.minHeight } : null),
          borderRadius:
            tall || l.tone === "primary" ? radius.button : radius.card,
          opacity: disabled
            ? DISABLED_OPACITY
            : pressed
              ? pressedOpacity.button
              : 1,
        },
        liftShadow(l.tone === "card" || verdict ? lift.sm : lift.md, t.shade),
      ]}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}、${sub}` : label}
      accessibilityState={{ disabled }}
    >
      <View style={[styles.row, centered && styles.centered]}>
        {icon && centered ? (
          <Icon name={icon} size={PLAIN_ICON} />
        ) : icon ? (
          <IconDisc
            name={icon}
            size={disc.size}
            iconSize={disc.icon}
            bg={props.disc ?? l.disc}
          />
        ) : null}
        <View style={[styles.textWrap, centered && styles.textCentered]}>
          <Text
            style={[
              styles.label,
              { color: t.fg },
              centered && styles.labelCentered,
            ]}
          >
            {label}
          </Text>
          {sub ? (
            <Text style={[styles.sub, { color: t.fg }]}>{sub}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: borderWidth.normal,
    paddingVertical: space.sm,
    paddingHorizontal: space.ms,
    minHeight: 88,
    justifyContent: "center",
  },
  tall: { minHeight: 112, padding: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.ms },
  centered: { justifyContent: "center" },
  textWrap: { flexShrink: 1, gap: space.tiny },
  textCentered: { alignItems: "center" },
  label: {
    fontSize: font.big,
    fontWeight: "700",
    lineHeight: lineHeight.big,
  },
  labelCentered: { textAlign: "center" },
  sub: {
    fontSize: font.small,
    lineHeight: lineHeight.small,
  },
});
