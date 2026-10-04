import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import BigButton from '../../components/BigButton';
import { CATEGORIES } from '../../constants';
import { Category } from '../../types';
import { useStore } from '../../data/store';
import { colors, font, space } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategorySelect'>;

export default function CategorySelectScreen({ navigation }: Props) {
  const { createConsultation } = useStore();
  // 続けて押されても相談を 1 件だけ作る（画面が切り替わる前の 2 回目以降は無視）。
  const submitting = useRef(false);

  const onSelect = (category: Category) => {
    if (submitting.current) return;
    submitting.current = true;
    const id = createConsultation(category);
    // replace にして、答え画面から「戻る」でホームに戻れるようにする。
    navigation.replace('ParentStatus', { consultationId: id });
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>どんな内容ですか？</Text>
      {CATEGORIES.map((c) => (
        <View key={c.key} style={{ marginBottom: space.md }}>
          <BigButton label={c.label} emoji={c.emoji} onPress={() => onSelect(c.key)} />
        </View>
      ))}
      <Text style={styles.note}>選ぶとすぐに相談が送られます</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: font.big,
    fontWeight: '700',
    color: colors.text,
    marginBottom: space.md,
  },
  note: {
    fontSize: font.small,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: space.sm,
  },
});