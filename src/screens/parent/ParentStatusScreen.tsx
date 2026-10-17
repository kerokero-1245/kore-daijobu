import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/types";
import Screen from "../../components/Screen";
import HomeButton from "../../components/HomeButton";
import Icon from "../../components/icons/Icon";
import IconDisc from "../../components/icons/IconDisc";
import WaitingRing from "../../components/WaitingRing";
import SyncErrorNotice from "../../components/SyncErrorNotice";
import { useStore } from "../../data/store";
import { CHILD_CALL_NAME, VERDICT_META } from "../../constants";
import { categoryLabel } from "../../domain/category";
import { answeredReply, isUnseenAnswer } from "../../domain/consultation";
import type { Reply } from "../../types";
import {
  borderWidth,
  colors,
  font,
  layout,
  lineHeight,
  radius,
  space,
  textStyle,
  verdictSoft,
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
          <View style={styles.home}>
            <HomeButton onPress={goHome} />
          </View>
        </View>
      </Screen>
    );
  }

  const reply = answeredReply(consultation);

  // 子の答え（判定の絵と色の見出し・判定の淡色の地と色の枠のカード）。判定の色は verdictStyle で 1 回だけ引く。
  const renderReply = (r: Reply) => {
    const tone = verdictStyle(r.verdict);
    return (
      <>
        <View style={styles.headlineBlock}>
          <Icon name={VERDICT_META[r.verdict].icon} size={88} />
          <Text style={[styles.headline, tone.text]}>
            {VERDICT_META[r.verdict].headline}
          </Text>
        </View>
        <View
          style={[
            styles.replyCard,
            tone.border,
            { backgroundColor: verdictSoft[r.verdict] },
          ]}
        >
          <Text style={styles.replyMessage}>{r.message}</Text>
          <View style={styles.fromRow}>
            <IconDisc
              name="child"
              size={32}
              iconSize={26}
              bg={colors.greenSoft}
            />
            <Text style={styles.replyFrom}>{CHILD_CALL_NAME}より</Text>
          </View>
        </View>
        <View style={styles.home}>
          <HomeButton onPress={goHome} />
        </View>
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
            <WaitingRing icon="child" />
            <Text style={styles.waiting}>
              {CHILD_CALL_NAME}に{"\n"}相談しています…
            </Text>
            <Text style={styles.waitingSub}>
              返事が来るまで、相手には「ちょっと待ってね」と伝えて、電話は切って大丈夫です。
            </Text>
            <View style={styles.home}>
              <HomeButton onPress={goHome} />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: space.md,
  },
  category: { ...textStyle.bodySub },
  info: {
    ...textStyle.body,
    textAlign: "center",
  },
  headlineBlock: { alignItems: "center", gap: space.sm },
  headline: {
    fontSize: font.title,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: lineHeight.title,
  },
  replyCard: {
    borderWidth: borderWidth.strong,
    borderRadius: radius.button,
    paddingTop: space.lg,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
    width: "100%",
    alignItems: "center",
    gap: space.ms,
  },
  replyMessage: {
    ...textStyle.bigStrong,
    textAlign: "center",
    lineHeight: lineHeight.big,
  },
  fromRow: { ...layout.centerRow, gap: space.s },
  replyFrom: { ...textStyle.caption },
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
    lineHeight: lineHeight.body,
  },
  home: { alignSelf: "stretch", marginTop: space.md },
});
