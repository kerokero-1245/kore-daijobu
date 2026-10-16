// 子のスマホ: 親のスマホに入れる 6 桁の番号を大きく出す。期限は 10 分で、残り時間を出す。
// 親の端末で番号が入るとペアが active になり、受信一覧へ切り替わる（App.tsx）。

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import RestartLink from "../../components/RestartLink";
import { useSession } from "../../data/session";
import type { Invite } from "../../data/backend";
import { formatRemaining } from "../../domain/pairing";
import {
  colors,
  font,
  lineHeight,
  radius,
  space,
  textStyle,
} from "../../theme";

export default function ChildPairingScreen() {
  const { createInvite } = useSession();
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
      <Text style={styles.lead}>
        親のスマホで「親のスマホ」を選び、この番号を入れてください。
      </Text>
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
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
      {invite ? (
        <Text style={styles.remaining}>
          {expired
            ? "期限が切れました。新しい番号を出してください。"
            : `のこり ${formatRemaining(invite.expiresAt, now)}`}
        </Text>
      ) : null}
      <View style={styles.button}>
        <BigButton label="新しい番号を出す" variant="primary" onPress={issue} />
      </View>
      <RestartLink />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    ...textStyle.body,
    lineHeight: lineHeight.body,
    marginBottom: space.lg,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: space.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  code: {
    fontSize: font.hero,
    fontWeight: "800",
    letterSpacing: 6,
    color: colors.text,
  },
  codeExpired: { color: colors.subtext, textDecorationLine: "line-through" },
  info: { ...textStyle.body, textAlign: "center", paddingHorizontal: space.md },
  remaining: {
    ...textStyle.bodySub,
    textAlign: "center",
    marginTop: space.md,
  },
  button: { marginTop: space.xl },
});
