// 画面の共通ラッパー。セーフエリアと余白・背景色をまとめる。

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean; // 内容が多いときは scroll を有効に
}

export default function Screen({ children, scroll }: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: space.md,
    paddingBottom: insets.bottom + space.md,
    paddingHorizontal: space.md,
  };
  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[pad, styles.grow]}
        // 内容が画面に収まっているときは縦にバウンスさせない（iOS）。
        alwaysBounceVertical={false}
        // キーボードが出ていても、1 回目のタップでボタンを押せるようにする。
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.root, pad, styles.flex]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  // 内容が短いときも画面の高さいっぱいに広げ、中央寄せの配置を保つ。
  grow: {
    flexGrow: 1,
  },
});