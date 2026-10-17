// 高齢者でも押しやすい大きなボタン。タップ領域と文字を大きく取る。
// 見た目は variant で選ぶ（色の組はここ 1 か所に持つ）:
//   card（既定）… 白いカード（枠線つき） / primary … 青地・白字 / verdict … 判定の色地・白字（verdict を渡す）
// disabled のときは押せず、薄く出す（読み上げにも「使用不可」と伝える）。

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  font,
  layout,
  pressedOpacity,
  radius,
  space,
  verdictColor,
} from "../theme";
import type { Verdict } from "../types";
import Emoji from "./Emoji";

type Props = {
  label: string;
  onPress: () => void;
  emoji?: string;
  sub?: string;
  disabled?: boolean;
} & (
  | { variant?: "card" }
  | { variant: "primary" }
  | { variant: "verdict"; verdict: Verdict }
);

// 押せないときの濃さ。
const DISABLED_OPACITY = 0.4;

// variant ごとの地の色・文字色・枠線。
function look(props: Props): { bg: string; fg: string; bordered: boolean } {
  switch (props.variant) {
    case "primary":
      return { bg: colors.primary, fg: colors.primaryText, bordered: false };
    case "verdict":
      return {
        bg: verdictColor[props.verdict],
        fg: colors.onColor,
        bordered: false,
      };
    default:
      return { bg: colors.surface, fg: colors.text, bordered: true };
  }
}

export default function BigButton(props: Props) {
  const { label, onPress, emoji, sub, disabled = false } = props;
  const { bg, fg, bordered } = look(props);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          opacity: disabled
            ? DISABLED_OPACITY
            : pressed
              ? pressedOpacity.button
              : 1,
        },
        bordered && styles.bordered,
      ]}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}、${sub}` : label}
      accessibilityState={{ disabled }}
    >
      <View style={styles.row}>
        {emoji ? <Emoji>{emoji}</Emoji> : null}
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
          {sub ? <Text style={[styles.sub, { color: fg }]}>{sub}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    minHeight: 88,
    justifyContent: "center",
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { ...layout.centerRow },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: font.big,
    fontWeight: "700",
  },
  sub: {
    fontSize: font.small,
    marginTop: space.tiny,
  },
});
