// 画面の共通ラッパー。セーフエリアと余白・背景色・中身の列の幅、ヘッダー帯の見た目をまとめる。
// ヘッダー帯は画面の地と同じクリームにして、境目の線を消し、題と戻るの矢印をこげ茶にする
// （画面の組の中にいるときだけ。起動中の画面は組の外なので何もしない）。

import React, { useContext, useLayoutEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, headerLook, size, space } from "../theme";

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
  const navigation = useContext(NavigationContext);
  // ヘッダーの見た目は画面ごとに 1 回だけ当てる（options を変えると画面の組が描き直されるので、
  // 描き直しのたびに当て直すと、描き直しが続くことがある）。
  const headerApplied = useRef(false);
  useLayoutEffect(() => {
    if (headerApplied.current || !navigation) return;
    headerApplied.current = true;
    navigation.setOptions(headerLook);
  }, [navigation]);
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
