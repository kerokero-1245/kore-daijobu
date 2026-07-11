import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import { colors, font, space } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentHome'>;

const CHILD_NAME = 'たろう'; // 仮の名前。ペアリング実装で置き換える。

export default function ParentHomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.lead}>あやしい電話や訪問がありましたか？</Text>
        <Pressable
          style={({ pressed }) => [styles.bigButton, pressed && { opacity: 0.9 }]}
          onPress={() => navigation.navigate('CategorySelect')}
          accessibilityRole="button"
          accessibilityLabel="これ大丈夫か相談する"
        >
          <Text style={styles.bigButtonEmoji}>🛡️</Text>
          <Text style={styles.bigButtonText}>これ、{'\n'}大丈夫？</Text>
        </Pressable>
        <Text style={styles.sub}>ボタンを押すと{'\n'}{CHILD_NAME} さんに相談できます</Text>
      </View>
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
});