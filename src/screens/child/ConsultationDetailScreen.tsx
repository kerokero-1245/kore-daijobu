import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import BigButton from '../../components/BigButton';
import { useStore } from '../../data/store';
import { categoryEmoji, categoryLabel, REPLY_TEMPLATES, VERDICT_HEADLINE } from '../../constants';
import { Verdict } from '../../types';
import { colors, font, radius, space, verdictColor } from '../../theme';
import { formatTime } from '../../util';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsultationDetail'>;

export default function ConsultationDetailScreen({ navigation, route }: Props) {
  const { getConsultation, replyToConsultation } = useStore();
  const consultation = getConsultation(route.params.consultationId);
  const [text, setText] = useState('');

  if (!consultation) {
    return (
      <Screen>
        <Text style={styles.info}>相談が見つかりませんでした。</Text>
      </Screen>
    );
  }

  const send = (verdict: Verdict, message: string) => {
    if (!message.trim()) return;
    replyToConsultation(consultation.id, verdict, message.trim());
    navigation.goBack();
  };

  const reply = consultation.status === 'answered' ? consultation.reply : undefined;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.emoji}>{categoryEmoji(consultation.category)}</Text>
        <View>
          <Text style={styles.category}>{categoryLabel(consultation.category)}</Text>
          <Text style={styles.time}>{formatTime(consultation.createdAt)}</Text>
        </View>
      </View>

      {reply ? (
        <View style={[styles.replyCard, { borderColor: verdictColor[reply.verdict] }]}>
          <Text style={[styles.replyHeadline, { color: verdictColor[reply.verdict] }]}>
            {VERDICT_HEADLINE[reply.verdict]}
          </Text>
          <Text style={styles.replyMessage}>{reply.message}</Text>
          <Text style={styles.replyNote}>返信済み。親の画面にも表示されています。</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>返信する（タップで送信）</Text>
          {REPLY_TEMPLATES.map((t) => (
            <View key={t.verdict} style={{ marginBottom: space.sm }}>
              <BigButton
                label={t.message}
                color={verdictColor[t.verdict]}
                textColor="#FFFFFF"
                onPress={() => send(t.verdict, t.message)}
              />
            </View>
          ))}

          <Text style={styles.orText}>自分の言葉で返信</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="例）その電話は詐欺だよ。相手にしないで大丈夫。"
            placeholderTextColor={colors.subtext}
            multiline
          />
          <BigButton
            label="この内容で送る"
            color={colors.primary}
            textColor="#FFFFFF"
            onPress={() => send('unsure', text)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg },
  emoji: { fontSize: font.huge, marginRight: space.md },
  category: { fontSize: font.big, fontWeight: '700', color: colors.text },
  time: { fontSize: font.small, color: colors.subtext, marginTop: 2 },
  info: { fontSize: font.body, color: colors.text },
  sectionTitle: { fontSize: font.body, fontWeight: '700', color: colors.text, marginBottom: space.md },
  orText: {
    fontSize: font.small,
    color: colors.subtext,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: font.body,
    color: colors.text,
    minHeight: 96,
    textAlignVertical: 'top',
    marginBottom: space.md,
  },
  replyCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
  },
  replyHeadline: { fontSize: font.big, fontWeight: '800', marginBottom: space.md, textAlign: 'center' },
  replyMessage: { fontSize: font.body, color: colors.text, textAlign: 'center', lineHeight: 30 },
  replyNote: { fontSize: font.small, color: colors.subtext, marginTop: space.md },
});