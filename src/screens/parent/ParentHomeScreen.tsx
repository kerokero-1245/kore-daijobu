import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import SyncErrorNotice from "../../components/SyncErrorNotice";
import { useStore } from "../../data/store";
import useOnce from "../../hooks/useOnce";
import { APP_NAME_TWO_LINES, CHILD_CALL_NAME } from "../../constants";
import { categoryLabel } from "../../domain/category";
import {
  entryLabel,
  isUnseenAnswer,
  pickEntries,
} from "../../domain/consultation";
import { formatTime } from "../../domain/time";
import type { Consultation } from "../../types";
import {
  colors,
  font,
  lineHeight,
  pressedOpacity,
  size,
  space,
  textStyle,
} from "../../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ParentHome">;

export default function ParentHomeScreen({ navigation }: Props) {
  const { consultations, syncError } = useStore();
  const entries = pickEntries(consultations);
  // まだ開いていない答えは、大ボタンより上に出して最初に目に入るようにする。
  const unseen = entries.filter(isUnseenAnswer);
  const others = entries.filter((c) => !isUnseenAnswer(c));

  // 1 つ目の遷移が終わるまで 2 つ目を受け付けない（続けて押すと画面が積み重なるのを防ぐ）。
  // この画面に戻ってきたら、また押せるようにする。
  const once = useOnce({ resetOnFocus: true });

  const renderEntry = (c: Consultation) => {
    const { emoji, label } = entryLabel(c);
    return (
      <View key={c.id} style={styles.entry}>
        <BigButton
          emoji={emoji}
          label={label}
          sub={`${categoryLabel(c.category)}・${formatTime(c.createdAt)}`}
          onPress={() =>
            once(() =>
              navigation.navigate("ParentStatus", { consultationId: c.id }),
            )
          }
        />
      </View>
    );
  };

  return (
    <Screen scroll>
      <SyncErrorNotice message={syncError} />
      {unseen.length > 0 ? (
        <View style={styles.unseen}>
          <Text style={styles.sectionTitle}>
            {CHILD_CALL_NAME}から答えが届いています
          </Text>
          {unseen.map(renderEntry)}
        </View>
      ) : null}

      <View style={styles.wrap}>
        <Text style={styles.lead}>あやしい電話や訪問がありましたか？</Text>
        <Pressable
          style={({ pressed }) => [
            styles.bigButton,
            pressed && { opacity: pressedOpacity.item },
          ]}
          onPress={() => once(() => navigation.navigate("CategorySelect"))}
          accessibilityRole="button"
          accessibilityLabel="これ大丈夫か相談する"
        >
          <Text style={styles.bigButtonEmoji}>🛡️</Text>
          <Text style={styles.bigButtonText}>{APP_NAME_TWO_LINES}</Text>
        </Pressable>
        <Text style={styles.sub}>
          ボタンを押すと{"\n"}
          {CHILD_CALL_NAME}に相談できます
        </Text>
      </View>

      {others.length > 0 ? (
        <View style={styles.others}>
          <Text style={styles.sectionTitle}>さいきんの相談</Text>
          {others.map(renderEntry)}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  lead: {
    ...textStyle.body,
    marginBottom: space.xl,
    textAlign: "center",
  },
  bigButton: {
    width: size.bigButton,
    height: size.bigButton,
    borderRadius: size.bigButton / 2,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bigButtonEmoji: { fontSize: font.hero, marginBottom: space.sm },
  bigButtonText: {
    fontSize: font.title,
    fontWeight: "800",
    color: colors.primaryText,
    textAlign: "center",
  },
  sub: {
    ...textStyle.bodySub,
    marginTop: space.xl,
    textAlign: "center",
    lineHeight: lineHeight.body,
  },
  unseen: { marginBottom: space.lg },
  others: { marginTop: space.lg },
  sectionTitle: {
    ...textStyle.bodyStrong,
    marginBottom: space.sm,
  },
  entry: { marginBottom: space.sm },
});
