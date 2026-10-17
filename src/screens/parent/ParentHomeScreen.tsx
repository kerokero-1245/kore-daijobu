import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import Icon from "../../components/icons/Icon";
import RepairLink from "../../components/RepairLink";
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
  borderWidth,
  colors,
  font,
  lift,
  liftShadow,
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
    const { icon, label } = entryLabel(c);
    return (
      <View key={c.id}>
        <BigButton
          icon={icon}
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
        <View style={styles.halo}>
          <Pressable
            style={({ pressed }) => [
              styles.bigButton,
              pressed && { opacity: pressedOpacity.item },
            ]}
            onPress={() => once(() => navigation.navigate("CategorySelect"))}
            accessibilityRole="button"
            accessibilityLabel="これ大丈夫か相談する"
          >
            <Icon name="shield" size={84} />
            <Text style={styles.bigButtonText}>{APP_NAME_TWO_LINES}</Text>
          </Pressable>
        </View>
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
      {/* 一番下に小さく「つなぎ直す」（押すと 1 回確かめる。src/components/RepairLink.tsx） */}
      <RepairLink />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  lead: {
    ...textStyle.body,
    lineHeight: lineHeight.body,
    marginBottom: space.ml,
    textAlign: "center",
  },
  // 大ボタンのまわりの淡い橙の輪。
  halo: {
    width: size.bigButtonHalo,
    height: size.bigButtonHalo,
    borderRadius: size.bigButtonHalo / 2,
    backgroundColor: colors.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bigButton: {
    width: size.bigButton,
    height: size.bigButton,
    borderRadius: size.bigButton / 2,
    backgroundColor: colors.primary,
    borderWidth: borderWidth.strong,
    borderColor: colors.primaryEdge,
    justifyContent: "center",
    alignItems: "center",
    gap: space.sm,
    // 下の影の厚みの分だけ上に上げて、輪の中で上下の見た目をそろえる。
    marginTop: -lift.lg,
    ...liftShadow(lift.lg, colors.primaryEdge),
  },
  bigButtonText: {
    fontSize: font.title,
    fontWeight: "800",
    color: colors.primaryText,
    textAlign: "center",
    lineHeight: lineHeight.title,
  },
  sub: {
    ...textStyle.bodySub,
    marginTop: space.ml,
    textAlign: "center",
    lineHeight: lineHeight.body,
  },
  unseen: { marginBottom: space.ml, gap: space.sm },
  others: { marginTop: space.ml, gap: space.sm },
  sectionTitle: { ...textStyle.bodyStrong },
});
