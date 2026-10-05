import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import BigButton from '../../components/BigButton';
import { useStore } from '../../data/store';
import { categoryLabel, CHILD_NAME } from '../../constants';
import { Consultation } from '../../types';
import { colors, font, space } from '../../theme';
import { formatTime } from '../../util';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentHome'>;

// 親ホームに出す相談の入口は最大 3 件。
const MAX_ENTRIES = 3;

// 並び順: 答えが届いて親がまだ開いていないもの → 返事待ち → 開いたことのある答え。同じ組の中は新しい順。
function entryRank(c: Consultation): number {
  if (c.status === 'answered' && !c.parentSeenAt) return 0;
  if (c.status === 'waiting') return 1;
  return 2;
}

function pickEntries(consultations: Consultation[]): Consultation[] {
  return [...consultations]
    .sort((a, b) => entryRank(a) - entryRank(b) || b.createdAt - a.createdAt)
    .slice(0, MAX_ENTRIES);
}

function entryLabel(c: Consultation): { emoji: string; label: string } {
  switch (entryRank(c)) {
    case 0:
      return { emoji: '📩', label: '答えが届きました' };
    case 1:
      return { emoji: '⏳', label: '返事を待っています' };
    default:
      return { emoji: '✔️', label: '確認ずみの答え' };
  }
}

export default function ParentHomeScreen({ navigation }: Props) {
  const { consultations } = useStore();
  const entries = pickEntries(consultations);
  // まだ開いていない答えは、大ボタンより上に出して最初に目に入るようにする。
  const unseen = entries.filter((c) => entryRank(c) === 0);
  const others = entries.filter((c) => entryRank(c) !== 0);

  // 1 つ目の遷移が終わるまで 2 つ目を受け付けない（続けて押すと画面が積み重なるのを防ぐ）。
  // この画面に戻ってきたら、また押せるようにする。
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, [])
  );
  const go = (fn: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    fn();
  };

  const renderEntry = (c: Consultation) => {
    const { emoji, label } = entryLabel(c);
    return (
      <View key={c.id} style={styles.entry}>
        <BigButton
          emoji={emoji}
          label={label}
          sub={`${categoryLabel(c.category)}・${formatTime(c.createdAt)}`}
          onPress={() => go(() => navigation.navigate('ParentStatus', { consultationId: c.id }))}
        />
      </View>
    );
  };

  return (
    <Screen scroll>
      {unseen.length > 0 ? (
        <View style={styles.unseen}>
          <Text style={styles.sectionTitle}>{CHILD_NAME} さんから答えが届いています</Text>
          {unseen.map(renderEntry)}
        </View>
      ) : null}

      <View style={styles.wrap}>
        <Text style={styles.lead}>あやしい電話や訪問がありましたか？</Text>
        <Pressable
          style={({ pressed }) => [styles.bigButton, pressed && { opacity: 0.9 }]}
          onPress={() => go(() => navigation.navigate('CategorySelect'))}
          accessibilityRole="button"
          accessibilityLabel="これ大丈夫か相談する"
        >
          <Text style={styles.bigButtonEmoji}>🛡️</Text>
          <Text style={styles.bigButtonText}>これ、{'\n'}大丈夫？</Text>
        </Pressable>
        <Text style={styles.sub}>ボタンを押すと{'\n'}{CHILD_NAME} さんに相談できます</Text>
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
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lead: {
    fontSize: font.body,
    color: colors.text,
    marginBottom: space.xl,
    textAlign: 'center',
  },
  bigButton: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bigButtonEmoji: { fontSize: 64, marginBottom: space.sm },
  bigButtonText: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.primaryText,
    textAlign: 'center',
  },
  sub: {
    fontSize: font.body,
    color: colors.subtext,
    marginTop: space.xl,
    textAlign: 'center',
    lineHeight: 30,
  },
  unseen: { marginBottom: space.lg },
  others: { marginTop: space.lg },
  sectionTitle: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: space.sm,
  },
  entry: { marginBottom: space.sm },
});
