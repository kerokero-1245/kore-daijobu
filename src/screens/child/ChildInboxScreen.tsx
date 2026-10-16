import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Emoji from "../../components/Emoji";
import RepairLink from "../../components/RepairLink";
import Screen from "../../components/Screen";
import Spacer from "../../components/Spacer";
import SyncErrorNotice from "../../components/SyncErrorNotice";
import StatusBadge, { STATUS_BADGE } from "../../components/StatusBadge";
import { APP_NAME } from "../../constants";
import { useStore } from "../../data/store";
import { categoryEmoji, categoryLabel } from "../../domain/category";
import { formatTime } from "../../domain/time";
import {
  colors,
  layout,
  lineHeight,
  pressedOpacity,
  radius,
  space,
  textStyle,
} from "../../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChildInbox">;

export default function ChildInboxScreen({ navigation }: Props) {
  const { consultations, syncError } = useStore();

  if (consultations.length === 0) {
    return (
      <Screen>
        <SyncErrorNotice message={syncError} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>まだ相談はありません。</Text>
          <Text style={styles.emptySub}>
            {`親が「${APP_NAME}」を押すと、ここに届きます。`}
          </Text>
        </View>
        <RepairLink />
      </Screen>
    );
  }

  return (
    <Screen>
      <SyncErrorNotice message={syncError} />
      <FlatList
        data={consultations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: space.sm }}
        ItemSeparatorComponent={() => <Spacer size="sm" />}
        ListFooterComponent={<RepairLink />}
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
              STATUS_BADGE[item.status].label
            }`}
          >
            <Emoji>{categoryEmoji(item.category)}</Emoji>
            <View style={{ flex: 1 }}>
              <Text style={styles.category}>
                {categoryLabel(item.category)}
              </Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <StatusBadge status={item.status} />
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
    ...layout.centerRow,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  category: { ...textStyle.bodyStrong },
  time: { ...textStyle.caption, marginTop: space.hair },
});
