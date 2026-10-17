import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import IconDisc from "../../components/icons/IconDisc";
import RepairLink from "../../components/RepairLink";
import Screen from "../../components/Screen";
import Spacer from "../../components/Spacer";
import SyncErrorNotice from "../../components/SyncErrorNotice";
import StatusBadge, { STATUS_BADGE } from "../../components/StatusBadge";
import { APP_NAME } from "../../constants";
import { useStore } from "../../data/store";
import { categoryIcon, categoryLabel } from "../../domain/category";
import { formatTime } from "../../domain/time";
import {
  borderWidth,
  colors,
  layout,
  lift,
  liftShadow,
  lineHeight,
  pressedOpacity,
  radius,
  space,
  textStyle,
  tone,
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
        {/* 一番下に小さく「つなぎ直す」（一覧があるときは FlatList の下。src/components/RepairLink.tsx） */}
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
            <IconDisc
              name={categoryIcon(item.category)}
              size={52}
              iconSize={38}
              bg={colors.orangeSoft}
            />
            <View style={styles.rowText}>
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
    gap: space.ms,
    backgroundColor: tone.card.bg,
    borderRadius: radius.key,
    borderWidth: borderWidth.normal,
    borderColor: tone.card.edge,
    padding: space.ms,
    ...liftShadow(lift.sm, tone.card.shade),
  },
  rowText: { flex: 1, minWidth: 0 },
  category: { ...textStyle.bodyStrong },
  time: { ...textStyle.caption, marginTop: space.hair },
});
