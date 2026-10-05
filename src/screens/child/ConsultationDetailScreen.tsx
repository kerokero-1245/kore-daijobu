import React, { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import Screen from '../../components/Screen';
import BigButton from '../../components/BigButton';
import { useStore } from '../../data/store';
import {
  categoryEmoji,
  categoryLabel,
  REPLY_TEMPLATES,
  VERDICT_CHOICES,
  VERDICT_HEADLINE,
} from '../../constants';
import { Verdict } from '../../types';
import { colors, font, radius, space, verdictColor } from '../../theme';
import { formatTime } from '../../util';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsultationDetail'>;

// 自由入力の返信の上限。親の答えの画面で読み切れる長さに抑える。
const MAX_REPLY_LENGTH = 200;

export default function ConsultationDetailScreen({ navigation, route }: Props) {
  const { getConsultation, replyToConsultation } = useStore();
  const consultation = getConsultation(route.params.consultationId);
  const [text, setText] = useState('');
  // 自由入力の返信で子が選んだ判定。選ぶまでは送れない。
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // 送れない状態で「送る」を押したら、理由を画面に出す。
  const [triedFree, setTriedFree] = useState(false);
  // 続けて押されても 1 回だけ送る（goBack が 2 回走らないように）。
  const sending = useRef(false);

  if (!consultation) {
    return (
      <Screen>
        <Text style={styles.info}>相談が見つかりませんでした。</Text>
      </Screen>
    );
  }

  const send = (v: Verdict, message: string) => {
    if (sending.current || !message.trim()) return;
    sending.current = true;
    replyToConsultation(consultation.id, v, message.trim());
    navigation.goBack();
  };

  const freeErrors: string[] = [];
  if (!text.trim()) freeErrors.push('返信の文面を入力してください');
  if (!verdict) freeErrors.push('判定を選んでください');

  const sendFree = () => {
    if (freeErrors.length > 0 || !verdict) {
      setTriedFree(true);
      // iOS は画面の変化を自動では読み上げないので、送れない理由を読み上げに通知する。
      // （Android は下の live region、Web は role="alert" で読み上げられる）
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(freeErrors.join('。'));
      return;
    }
    send(verdict, text);
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

          <Text style={styles.orText}>自分の言葉で返信（{MAX_REPLY_LENGTH}字まで）</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="例）その電話は詐欺だよ。相手にしないで大丈夫。"
            placeholderTextColor={colors.subtext}
            maxLength={MAX_REPLY_LENGTH}
            multiline
          />
          <Text style={styles.choiceTitle}>判定を選ぶ</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="判定">
            {VERDICT_CHOICES.map((c) => {
              const selected = verdict === c.verdict;
              const tint = verdictColor[c.verdict];
              return (
                <Pressable
                  key={c.verdict}
                  onPress={() => setVerdict(c.verdict)}
                  accessibilityRole="radio"
                  accessibilityLabel={c.label}
                  aria-checked={selected}
                  style={({ pressed }) => [
                    styles.choice,
                    { borderColor: selected ? tint : colors.border },
                    selected && { backgroundColor: tint },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.choiceText, { color: selected ? '#FFFFFF' : tint }]}>
                    {selected ? '● ' : '○ '}
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 外側は常に置いておき、中身が変わったら Android が読み上げる（live region） */}
          <View accessibilityLiveRegion="assertive">
            {triedFree && freeErrors.length > 0 ? (
              <View accessibilityRole="alert" style={styles.errors}>
                {freeErrors.map((e) => (
                  <Text key={e} style={styles.errorText}>
                    {e}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          <BigButton
            label="この内容で送る"
            color={colors.primary}
            textColor="#FFFFFF"
            onPress={sendFree}
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
  choiceTitle: {
    fontSize: font.small,
    color: colors.subtext,
    marginBottom: space.sm,
  },
  choice: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    minHeight: 56,
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  choiceText: { fontSize: font.body, fontWeight: '700' },
  errors: { marginTop: space.xs, marginBottom: space.md },
  errorText: { fontSize: font.body, fontWeight: '700', color: colors.danger, marginTop: space.xs },
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