// 画面の共通ラッパー。セーフエリアと余白・背景色・中身の列の幅をまとめる。
// ヘッダー帯の見た目は App.tsx の画面の組の設定（screenOptions）で当てる。

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, size, space } from "../theme";

interface Props {
  children: React.ReactNode;
  scroll?: boolean; // 内容が多いときは scroll を有効に
  padY?: number; // 上下の余白（既定は space.md）
  onViewportHeight?: (height: number) => void; // 表示域（ヘッダーの下）の高さを知りたい画面に
}

export default function Screen({
  children,
  scroll,
  padY = space.md,
  onViewportHeight,
}: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: padY,
    paddingBottom: insets.bottom + padY,
    paddingHorizontal: space.md,
  };
  const onLayout = onViewportHeight
    ? (e: { nativeEvent: { layout: { height: number } } }) =>
        onViewportHeight(e.nativeEvent.layout.height)
    : undefined;
  const column = <View style={styles.column}>{children}</View>;
  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[pad, styles.grow]}
        onLayout={onLayout}
        // 内容が画面に収まっているときは縦にバウンスさせない（iOS）。
        alwaysBounceVertical={false}
        // キーボードが出ていても、1 回目のタップでボタンを押せるようにする。
        keyboardShouldPersistTaps="handled"
      >
        {column}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.root, pad, styles.flex]} onLayout={onLayout}>
      {column}
    </View>
  );
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
  // 横に広い画面（タブレット・PC のブラウザ）では、中身を size.content の幅の列にして中央に置く。
  column: {
    flexGrow: 1,
    width: "100%",
    maxWidth: size.content,
    alignSelf: "center",
  },
});
