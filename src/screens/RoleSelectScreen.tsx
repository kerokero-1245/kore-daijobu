import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import BigButton from "../components/BigButton";
import Spacer from "../components/Spacer";
import { APP_NAME } from "../constants";
import { useSession } from "../data/session";
import type { Role } from "../domain/pairing";
import { colors, font, lineHeight, space, textStyle } from "../theme";

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
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.note}>
          このスマホはどちらですか？　親のスマホは相談を送る側、あなたのスマホは相談に答える側になります。
        </Text>
      </View>
      <View style={styles.buttons}>
        <BigButton
          label="親のスマホ"
          emoji="👵"
          sub="相談を送る側"
          variant="primary"
          onPress={() => choose("parent")}
        />
        <Spacer size="md" />
        <BigButton
          label="子のスマホ"
          emoji="🧑"
          sub="相談に答える側（あなたのスマホ）"
          onPress={() => choose("child")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: space.lg, marginBottom: space.xl },
  title: {
    fontSize: font.huge,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  note: {
    ...textStyle.caption,
    marginTop: space.md,
    textAlign: "center",
    lineHeight: lineHeight.small,
  },
  buttons: { marginTop: space.lg },
});
