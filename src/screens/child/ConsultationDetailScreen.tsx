import React, { useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import Icon from "../../components/icons/Icon";
import IconDisc from "../../components/icons/IconDisc";
import RadioMark from "../../components/icons/RadioMark";
import SyncErrorNotice from "../../components/SyncErrorNotice";
import { useStore } from "../../data/store";
import useOnce from "../../hooks/useOnce";
import { REPLY_TEMPLATES, VERDICT_META, VERDICT_ORDER } from "../../constants";
import { categoryIcon, categoryLabel } from "../../domain/category";
import { answeredReply } from "../../domain/consultation";
import { freeReplyErrors, MAX_REPLY_LENGTH } from "../../domain/reply";
import { formatTime } from "../../domain/time";
import type { Reply, Verdict } from "../../types";
import {
  borderWidth,
  colors,
  font,
  layout,
  lineHeight,
  pressedOpacity,
  radius,
  space,
  textStyle,
  verdictColor,
  verdictSoft,
  verdictStyle,
} from "../../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ConsultationDetail">;

export default function ConsultationDetailScreen({ navigation, route }: Props) {
  const { getConsultation, replyToConsultation, syncError } = useStore();
  const consultation = getConsultation(route.params.consultationId);
  const [text, setText] = useState("");
  // 自由入力の返信で子が選んだ判定。選ぶまでは送れない。
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // 送れない状態で「送る」を押したら、理由を画面に出す。
  const [triedFree, setTriedFree] = useState(false);
  // 続けて押されても 1 回だけ送る（goBack が 2 回走らないように）。
  const once = useOnce();

  if (!consultation) {
    return (
      <Screen>
        <SyncErrorNotice message={syncError} />
        <Text style={styles.info}>相談が見つかりませんでした。</Text>
      </Screen>
    );
  }

  const send = (v: Verdict, message: string) => {
    if (!message.trim()) return;
    once(() => {
      replyToConsultation(consultation.id, v, message.trim());
      navigation.goBack();
    });
  };

  const freeErrors = freeReplyErrors(text, verdict);

  const sendFree = () => {
    if (freeErrors.length > 0 || !verdict) {
      setTriedFree(true);
      // iOS は画面の変化を自動では読み上げないので、送れない理由を読み上げに通知する。
      // （Android は下の live region、Web は role="alert" で読み上げられる）
      if (Platform.OS === "ios")
        AccessibilityInfo.announceForAccessibility(freeErrors.join("。"));
      return;
    }
    send(verdict, text);
  };

  const reply = answeredReply(consultation);

  // 子が送った返信（判定の色の枠と見出し）。判定の色は verdictStyle で 1 回だけ引く。
  const renderReply = (r: Reply) => {
    const tone = verdictStyle(r.verdict);
    return (
      <View
        style={[
          styles.replyCard,
          tone.border,
          { backgroundColor: verdictSoft[r.verdict] },
        ]}
      >
        <View style={styles.replyHeadlineRow}>
          <Icon name={VERDICT_META[r.verdict].icon} size={32} />
          <Text style={[styles.replyHeadline, tone.text]}>
            {VERDICT_META[r.verdict].headline}
          </Text>
        </View>
        <Text style={styles.replyMessage}>{r.message}</Text>
        <Text style={styles.replyNote}>
          返信済み。親の画面にも表示されています。
        </Text>
      </View>
    );
  };

  return (
    <Screen scroll>
      <SyncErrorNotice message={syncError} />
      <View style={styles.header}>
        <IconDisc
          name={categoryIcon(consultation.category)}
          size={64}
          iconSize={46}
          bg={colors.orangeSoft}
        />
        <View style={styles.headerText}>
          <Text style={styles.category}>
            {categoryLabel(consultation.category)}
          </Text>
          <Text style={styles.time}>{formatTime(consultation.createdAt)}</Text>
        </View>
      </View>

      {reply ? (
        renderReply(reply)
      ) : (
        <>
          <Text style={styles.sectionTitle}>返信する（タップで送信）</Text>
          <View style={styles.templates}>
            {REPLY_TEMPLATES.map((t) => (
              <BigButton
                key={t.verdict}
                label={t.message}
                icon={VERDICT_META[t.verdict].icon}
                variant="verdict"
                verdict={t.verdict}
                onPress={() => send(t.verdict, t.message)}
              />
            ))}
          </View>

          <Text style={styles.orText}>
            自分の言葉で返信（{MAX_REPLY_LENGTH}字まで）
          </Text>
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
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="判定"
            style={styles.choices}
          >
            {VERDICT_ORDER.map((v) => {
              const selected = verdict === v;
              const tint = verdictColor[v];
              const { label } = VERDICT_META[v];
              return (
                <Pressable
                  key={v}
                  onPress={() => setVerdict(v)}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  aria-checked={selected}
                  style={({ pressed }) => [
                    styles.choice,
                    { borderColor: selected ? tint : colors.border },
                    selected && { backgroundColor: tint },
                    pressed && { opacity: pressedOpacity.item },
                  ]}
                >
                  <RadioMark
                    selected={selected}
                    color={selected ? colors.onColor : tint}
                    size={24}
                  />
                  <Text
                    style={[
                      styles.choiceText,
                      { color: selected ? colors.onColor : tint },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 外側は常に置いておき、中身が変わったら Android が読み上げる（live region）。
              Web は内側の role="alert" で読み上げるので、二重にならないよう Android だけに付ける */}
          <View
            accessibilityLiveRegion={
              Platform.OS === "android" ? "assertive" : undefined
            }
          >
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
            variant="primary"
            onPress={sendFree}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    ...layout.centerRow,
    gap: space.ms,
    marginBottom: space.ml,
  },
  headerText: { flexShrink: 1 },
  category: { ...textStyle.bigStrong },
  time: { ...textStyle.caption, marginTop: space.hair },
  info: { ...textStyle.body },
  sectionTitle: {
    ...textStyle.bodyStrong,
    marginBottom: space.ms,
  },
  templates: { gap: space.sm },
  orText: {
    ...textStyle.caption,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.normal,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingVertical: space.ms,
    paddingHorizontal: space.md,
    ...textStyle.body,
    lineHeight: lineHeight.body,
    minHeight: 104,
    textAlignVertical: "top",
    marginBottom: space.md,
  },
  choiceTitle: {
    ...textStyle.caption,
    marginBottom: space.sm,
  },
  choices: { gap: space.sm, marginBottom: space.sm },
  choice: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.normal,
    borderRadius: radius.choice,
    paddingVertical: space.sm,
    paddingHorizontal: space.ms,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  choiceText: { fontSize: font.body, fontWeight: "700", flexShrink: 1 },
  errors: { marginTop: space.xs, marginBottom: space.md },
  errorText: {
    ...textStyle.bodyStrong,
    color: colors.danger,
    marginTop: space.xs,
  },
  replyCard: {
    borderWidth: borderWidth.strong,
    borderRadius: radius.button,
    padding: space.lg,
    alignItems: "center",
  },
  replyHeadlineRow: {
    ...layout.centerRow,
    gap: space.s,
    marginBottom: space.md,
  },
  replyHeadline: {
    fontSize: font.big,
    fontWeight: "800",
    textAlign: "center",
  },
  replyMessage: {
    ...textStyle.body,
    textAlign: "center",
    lineHeight: lineHeight.body,
  },
  replyNote: {
    ...textStyle.caption,
    marginTop: space.md,
  },
});
