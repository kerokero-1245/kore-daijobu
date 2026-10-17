import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Screen from "../../components/Screen";
import HomeButton from "../../components/HomeButton";
import Icon from "../../components/icons/Icon";
import Spacer from "../../components/Spacer";
import SyncErrorNotice from "../../components/SyncErrorNotice";
import { useStore } from "../../data/store";
import { CHILD_CALL_NAME, VERDICT_META } from "../../constants";
import { categoryLabel } from "../../domain/category";
import { answeredReply, isUnseenAnswer } from "../../domain/consultation";
import type { Reply } from "../../types";
import {
  colors,
  font,
  lineHeight,
  radius,
  space,
  textStyle,
  verdictStyle,
} from "../../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ParentStatus">;

export default function ParentStatusScreen({ navigation, route }: Props) {
  const { getConsultation, markAnswerSeen, syncError } = useStore();
  const consultation = getConsultation(route.params.consultationId);
  const answeredUnseen =
    consultation !== undefined && isUnseenAnswer(consultation);
  // 答えが表示されたら「親が開いた」と記録する（親ホームの並び順に使う）。
  useEffect(() => {
    if (answeredUnseen) markAnswerSeen(route.params.consultationId);
  }, [answeredUnseen, markAnswerSeen, route.params.consultationId]);
  // navigate だと ParentHome が新しく積まれるので、既存の ParentHome まで戻る。
  const goHome = () => navigation.popTo("ParentHome");

  if (!consultation) {
    return (
      <Screen>
        <SyncErrorNotice message={syncError} />
        <View style={styles.center}>
          <Text style={styles.info}>相談が見つかりませんでした。</Text>
          <HomeButton onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const reply = answeredReply(consultation);

  // 子の答え（判定の色の見出し・色の枠のカード）。判定の色は verdictStyle で 1 回だけ引く。
  const renderReply = (r: Reply) => {
    const tone = verdictStyle(r.verdict);
    return (
      <>
        <View style={styles.headlineIcon}>
          <Icon name={VERDICT_META[r.verdict].icon} size={88} />
        </View>
        <Text style={[styles.headline, tone.text]}>
          {VERDICT_META[r.verdict].headline}
        </Text>
        <View style={[styles.replyCard, tone.border]}>
          <Text style={styles.replyMessage}>{r.message}</Text>
          <Text style={styles.replyFrom}>{CHILD_CALL_NAME}より</Text>
        </View>
        <Spacer size="xl" />
        <HomeButton onPress={goHome} />
      </>
    );
  };

  // 長い返信でも見出しが隠れないよう、スクロールできる画面にする（内容が短いときは中央寄せ）。
  return (
    <Screen scroll>
      <SyncErrorNotice message={syncError} />
      <View style={styles.center}>
        <Text style={styles.category}>
          {categoryLabel(consultation.category)}
        </Text>

        {reply ? (
          renderReply(reply)
        ) : (
          <>
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginVertical: space.lg }}
            />
            <Text style={styles.waiting}>
              {CHILD_CALL_NAME}に{"\n"}相談しています…
            </Text>
            <Text style={styles.waitingSub}>
              返事が来るまで、相手には「ちょっと待ってね」と伝えて、電話は切って大丈夫です。
            </Text>
            <Spacer size="xl" />
            <HomeButton onPress={goHome} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  category: {
    ...textStyle.bodySub,
    marginBottom: space.md,
  },
  info: {
    ...textStyle.body,
    marginBottom: space.lg,
    textAlign: "center",
  },
  headlineIcon: { marginBottom: space.sm },
  headline: {
    fontSize: font.title,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: space.lg,
  },
  replyCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    width: "100%",
    alignItems: "center",
  },
  replyMessage: {
    ...textStyle.bigStrong,
    textAlign: "center",
    lineHeight: lineHeight.big,
  },
  replyFrom: {
    ...textStyle.caption,
    marginTop: space.md,
  },
  waiting: {
    fontSize: font.title,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: lineHeight.title,
  },
  waitingSub: {
    ...textStyle.bodySub,
    textAlign: "center",
    marginTop: space.lg,
    lineHeight: lineHeight.body,
  },
});
