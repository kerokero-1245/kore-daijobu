import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import BigButton from '../../components/BigButton';
import { useStore } from '../../data/store';
import { categoryLabel, CHILD_NAME, VERDICT_HEADLINE } from '../../constants';
import { colors, font, radius, space, verdictColor } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentStatus'>;

export default function ParentStatusScreen({ navigation, route }: Props) {
  const { getConsultation, markAnswerSeen } = useStore();
  const consultation = getConsultation(route.params.consultationId);
  const answeredUnseen = consultation?.status === 'answered' && !consultation.parentSeenAt;
  // 答えが表示されたら「親が開いた」と記録する（親ホームの並び順に使う）。
  useEffect(() => {
    if (answeredUnseen) markAnswerSeen(route.params.consultationId);
  }, [answeredUnseen, markAnswerSeen, route.params.consultationId]);
  // navigate だと ParentHome が新しく積まれるので、既存の ParentHome まで戻る。
  const goHome = () => navigation.popTo('ParentHome');

  if (!consultation) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.info}>相談が見つかりませんでした。</Text>
          <BigButton
            label="ホームにもどる"
            color={colors.primary}
            textColor={colors.primaryText}
            onPress={goHome}
          />
        </View>
      </Screen>
    );
  }

  const reply = consultation.status === 'answered' ? consultation.reply : undefined;

  // 長い返信でも見出しが隠れないよう、スクロールできる画面にする（内容が短いときは中央寄せ）。
  return (
    <Screen scroll>
      <View style={styles.center}>
        <Text style={styles.category}>{categoryLabel(consultation.category)}</Text>

        {reply ? (
          <>
            <Text style={[styles.headline, { color: verdictColor[reply.verdict] }]}>
              {VERDICT_HEADLINE[reply.verdict]}
            </Text>
            <View style={[styles.replyCard, { borderColor: verdictColor[reply.verdict] }]}>
              <Text style={styles.replyMessage}>{reply.message}</Text>
              <Text style={styles.replyFrom}>{CHILD_NAME} さんより</Text>
            </View>
            <View style={{ height: space.xl }} />
            <BigButton
              label="ホームにもどる"
              color={colors.primary}
              textColor={colors.primaryText}
              onPress={goHome}
            />
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: space.lg }} />
            <Text style={styles.waiting}>{CHILD_NAME} さんに{'\n'}相談しています…</Text>
            <Text style={styles.waitingSub}>
              返事が来るまで、相手には「ちょっと待ってね」と伝えて、電話は切って大丈夫です。
            </Text>
            <View style={{ height: space.xl }} />
            <BigButton
              label="ホームにもどる"
              color={colors.primary}
              textColor={colors.primaryText}
              onPress={goHome}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  category: { fontSize: font.body, color: colors.subtext, marginBottom: space.md },
  info: { fontSize: font.body, color: colors.text, marginBottom: space.lg, textAlign: 'center' },
  headline: { fontSize: font.title, fontWeight: '800', textAlign: 'center', marginBottom: space.lg },
  replyCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    width: '100%',
    alignItems: 'center',
  },
  replyMessage: { fontSize: font.big, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 34 },
  replyFrom: { fontSize: font.small, color: colors.subtext, marginTop: space.md },
  waiting: { fontSize: font.title, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 42 },
  waitingSub: {
    fontSize: font.body,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: space.lg,
    lineHeight: 30,
  },
});