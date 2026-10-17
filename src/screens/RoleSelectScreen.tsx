import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import BigButton from "../components/BigButton";
import IconDisc from "../components/icons/IconDisc";
import { APP_NAME } from "../constants";
import { useSession } from "../data/session";
import type { Role } from "../domain/pairing";
import {
  colors,
  font,
  layout,
  lineHeight,
  radius,
  space,
  textStyle,
} from "../theme";

// 最初の入口。このスマホを「親」「子」のどちらで使うかを選ぶ（選んだ役割はあとから変えない）。
// 選んだあとは、子は番号を出す画面、親は番号を入れる画面へ進む（画面の切り替えは App.tsx）。
export default function RoleSelectScreen() {
  const { chooseRole } = useSession();
  // 続けて押されても 1 回だけ保存する。
  const [busy, setBusy] = useState(false);
  const choose = (role: Role) => {
    if (busy) return;
    setBusy(true);
    void chooseRole(role).finally(() => setBusy(false));
  };

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.pair} aria-hidden>
          <IconDisc
            name="parent"
            size={80}
            iconSize={60}
            bg={colors.orangeSoft}
          />
          <View style={styles.dots}>
            {DOTS.map((w, i) => (
              <View key={i} style={[styles.dot, { width: w }]} />
            ))}
          </View>
          <IconDisc
            name="child"
            size={80}
            iconSize={60}
            bg={colors.greenSoft}
          />
        </View>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.note}>
          このスマホはどちらですか？　親のスマホは相談を送る側、あなたのスマホは相談に答える側になります。
        </Text>
      </View>
      <View style={styles.buttons}>
        <BigButton
          label="親のスマホ"
          icon="parent"
          sub="相談を送る側"
          variant="primary"
          tall
          onPress={() => choose("parent")}
        />
        <BigButton
          label="子のスマホ"
          icon="child"
          disc={colors.greenSoft}
          sub="相談に答える側（あなたのスマホ）"
          tall
          onPress={() => choose("child")}
        />
      </View>
    </Screen>
  );
}

// 親と子の絵の間の点線（短い線 4 本と少し長い線 1 本）。
const DOTS = [4, 4, 4, 4, 8];

const styles = StyleSheet.create({
  top: {
    alignItems: "center",
    gap: space.ms,
    paddingTop: space.s,
    marginBottom: space.lg,
  },
  pair: { ...layout.centerRow, gap: space.sm },
  dots: { ...layout.centerRow, gap: space.s },
  dot: { height: 3, borderRadius: radius.pill, backgroundColor: colors.border },
  title: {
    fontSize: font.huge,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.text,
    textAlign: "center",
  },
  note: {
    ...textStyle.caption,
    textAlign: "center",
    lineHeight: lineHeight.small,
  },
  buttons: { marginTop: space.s, gap: space.md },
});
