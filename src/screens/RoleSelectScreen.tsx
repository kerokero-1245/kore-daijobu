import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/types";
import Screen from "../components/Screen";
import BigButton from "../components/BigButton";
import Spacer from "../components/Spacer";
import { APP_NAME } from "../constants";
import { colors, font, lineHeight, space, textStyle } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "RoleSelect">;

// 開発用の入口。1台で「親」「子」を切り替えて一往復の流れをテストするための画面。
// 本番ではペアリングで役割が固定され、この画面は出ない。
export default function RoleSelectScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.note}>
          開発用の入口です。実際のアプリでは、親のスマホは「親」、あなたのスマホは「子」に固定されます。
        </Text>
      </View>
      <View style={styles.buttons}>
        <BigButton
          label="親モードで開く"
          emoji="👵"
          sub="相談を送る側（親のスマホ）"
          variant="primary"
          onPress={() => navigation.navigate("ParentHome")}
        />
        <Spacer size="md" />
        <BigButton
          label="子モードで開く"
          emoji="🧑"
          sub="相談に答える側（あなたのスマホ）"
          onPress={() => navigation.navigate("ChildInbox")}
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
