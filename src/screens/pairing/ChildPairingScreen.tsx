// 子のスマホ: 親のスマホに入れる 6 桁の番号を大きく出す。期限は 10 分で、残り時間を出す。
// 親の端末で番号が入るとペアが active になり、受信一覧へ切り替わる（App.tsx）。
// 親のスマホで「子のスマホ」を選んでしまったときのために、一番下に「役割を選び直す」を置く。押すと
// session の restart（ホームの「つなぎ直す」と同じ。サインアウトして新しい匿名ユーザーで役割の選択へ）を
// 呼ぶ。まだつながっていないので消える相談は無く、確かめずに戻す。

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import Icon from "../../components/icons/Icon";
import IconDisc from "../../components/icons/IconDisc";
import { useSession } from "../../data/session";
import type { Invite } from "../../data/backend";
import { formatRemaining } from "../../domain/pairing";
import {
  borderWidth,
  colors,
  font,
  layout,
  lift,
  liftShadow,
  lineHeight,
  radius,
  space,
  textStyle,
  tone,
} from "../../theme";

export default function ChildPairingScreen() {
  const { createInvite, restart } = useSession();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // 発行中は「新しい番号を出す」を受け付けない（新しい番号で古い番号は無効になるので、
  // 応答の届く順が入れ替わると、無効になった番号が画面に残ることがある）。
  const busy = useRef(false);
  // 最初の番号は画面を開いたときに 1 回だけ出す（前面復帰などで出し直さない）。
  const issuedOnMount = useRef(false);

  const issue = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    createInvite()
      .then(
        (i) => {
          setError(false);
          setInvite(i);
          setNow(Date.now());
        },
        (e: unknown) => {
          console.warn("番号を出せませんでした", e);
          setError(true);
        },
      )
      .finally(() => {
        busy.current = false;
      });
  }, [createInvite]);

  useEffect(() => {
    if (issuedOnMount.current) return;
    issuedOnMount.current = true;
    issue();
  }, [issue]);

  // 残り時間を 1 秒ごとに進める。
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expired = invite !== null && invite.expiresAt <= now;

  return (
    <Screen scroll>
      <View style={styles.leadRow}>
        <IconDisc name="child" size={64} iconSize={48} bg={colors.greenSoft} />
        <Text style={styles.lead}>
          親のスマホで「親のスマホ」を選び、この番号を入れてください。
        </Text>
      </View>
      <View style={styles.codeBox}>
        {invite ? (
          <Text
            style={[styles.code, expired && styles.codeExpired]}
            accessibilityLabel={`番号 ${invite.code.split("").join(" ")}`}
            testID="invite-code"
          >
            {invite.code}
          </Text>
        ) : error ? (
          <Text style={styles.info}>
            番号を出せませんでした。下のボタンで、もう一度ためしてください。
          </Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primaryEdge} />
        )}
        {invite ? (
          <View style={styles.remainingRow}>
            {expired ? null : <Icon name="timer" size={24} />}
            <Text style={styles.remaining}>
              {expired
                ? "期限が切れました。新しい番号を出してください。"
                : `のこり ${formatRemaining(invite.expiresAt, now)}`}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.button}>
        <BigButton label="新しい番号を出す" variant="primary" onPress={issue} />
      </View>
      <View style={styles.reselect}>
        <Text style={styles.reselectNote}>
          このスマホが親のスマホなら、役割を選び直してください。
        </Text>
        <BigButton label="役割を選び直す" onPress={() => void restart()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  leadRow: { ...layout.centerRow, gap: space.ms, marginBottom: space.ml },
  lead: {
    ...textStyle.body,
    lineHeight: lineHeight.body,
    flexShrink: 1,
  },
  codeBox: {
    backgroundColor: tone.card.bg,
    borderWidth: borderWidth.normal,
    borderColor: tone.card.edge,
    borderRadius: radius.button,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    paddingHorizontal: space.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 160,
    ...liftShadow(lift.md, tone.card.shade),
  },
  code: {
    fontSize: font.hero,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.text,
  },
  codeExpired: { color: colors.subtext, textDecorationLine: "line-through" },
  info: { ...textStyle.body, textAlign: "center", paddingHorizontal: space.md },
  remainingRow: { ...layout.centerRow, gap: space.s },
  remaining: {
    ...textStyle.bodySub,
    textAlign: "center",
    flexShrink: 1,
  },
  button: { marginTop: space.xl },
  reselect: { marginTop: space.xl, gap: space.sm },
  reselectNote: { ...textStyle.bodySub, lineHeight: lineHeight.body },
});
