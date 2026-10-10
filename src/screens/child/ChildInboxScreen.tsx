import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Screen from "../../components/Screen";
import { useStore } from "../../data/store";
import { categoryEmoji, categoryLabel } from "../../domain/category";
import { isAnswered } from "../../domain/consultation";
import { formatTime } from "../../domain/time";
import {
  colors,
  font,
  lineHeight,
  pressedOpacity,
  radius,
  space,
  textStyle,
} from "../../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChildInbox">;

export default function ChildInboxScreen({ navigation }: Props) {
  const { consultations } = useStore();

  if (consultations.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>まだ相談はありません。</Text>
          <Text style={styles.emptySub}>
            親が「これ、大丈夫？」を押すと、ここに届きます。
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={consultations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: space.sm }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && { opacity: pressedOpacity.item },
            ]}
            onPress={() =>
              navigation.navigate("ConsultationDetail", {
                consultationId: item.id,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`${categoryLabel(item.category)}、${formatTime(item.createdAt)}、${
              isAnswered(item) ? "返信済み" : "未対応"
            }`}
          >
            <Text style={styles.emoji}>{categoryEmoji(item.category)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.category}>
                {categoryLabel(item.category)}
              </Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <View
              style={[
                styles.badge,
                isAnswered(item) ? styles.badgeDone : styles.badgeWaiting,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isAnswered(item)
                    ? styles.badgeTextDone
                    : styles.badgeTextWaiting,
                ]}
              >
                {isAnswered(item) ? "返信済み" : "未対応"}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  emptyText: { ...textStyle.bigStrong },
  emptySub: {
    ...textStyle.bodySub,
    marginTop: space.md,
    textAlign: "center",
    lineHeight: lineHeight.body,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  emoji: { fontSize: font.title, marginRight: space.md },
  category: { ...textStyle.bodyStrong },
  time: { ...textStyle.caption, marginTop: space.hair },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.tiny,
  },
  badgeWaiting: { backgroundColor: colors.dangerSoft },
  badgeDone: { backgroundColor: colors.safeSoft },
  badgeText: { fontSize: font.small, fontWeight: "700" },
  badgeTextWaiting: { color: colors.danger },
  badgeTextDone: { color: colors.safe },
});
