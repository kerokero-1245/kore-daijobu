import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import { useStore } from '../../data/store';
import { categoryEmoji, categoryLabel } from '../../constants';
import { colors, font, radius, space } from '../../theme';
import { formatTime } from '../../util';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildInbox'>;

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
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
            onPress={() => navigation.navigate('ConsultationDetail', { consultationId: item.id })}
          >
            <Text style={styles.emoji}>{categoryEmoji(item.category)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.category}>{categoryLabel(item.category)}</Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <View
              style={[
                styles.badge,
                item.status === 'answered' ? styles.badgeDone : styles.badgeWaiting,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  item.status === 'answered' ? styles.badgeTextDone : styles.badgeTextWaiting,
                ]}
              >
                {item.status === 'answered' ? '返信済み' : '未対応'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.lg },
  emptyText: { fontSize: font.big, fontWeight: '700', color: colors.text },
  emptySub: {
    fontSize: font.body,
    color: colors.subtext,
    marginTop: space.md,
    textAlign: 'center',
    lineHeight: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  emoji: { fontSize: font.title, marginRight: space.md },
  category: { fontSize: font.body, fontWeight: '700', color: colors.text },
  time: { fontSize: font.small, color: colors.subtext, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 4 },
  badgeWaiting: { backgroundColor: '#FDECEA' },
  badgeDone: { backgroundColor: '#E7F4EF' },
  badgeText: { fontSize: font.small, fontWeight: '700' },
  badgeTextWaiting: { color: colors.danger },
  badgeTextDone: { color: colors.safe },
});