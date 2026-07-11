// 高齢者でも押しやすい大きなボタン。タップ領域と文字を大きく取る。

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  emoji?: string;
  sub?: string;
  color?: string; // 背景色（省略時は白カード）
  textColor?: string;
}

export default function BigButton({ label, onPress, emoji, sub, color, textColor }: Props) {
  const bg = color ?? colors.surface;
  const fg = textColor ?? colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        !color && styles.bordered,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.row}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
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
    justifyContent: 'center',
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: font.title,
    marginRight: space.md,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: font.big,
    fontWeight: '700',
  },
  sub: {
    fontSize: font.small,
    marginTop: 4,
    opacity: 0.8,
  },
});