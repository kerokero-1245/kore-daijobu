// 親のスマホ: 子のスマホに出ている 6 桁の番号を入れる。最初の設定として、子が親のスマホで打つ前提。
// 6 桁そろうと「つなぐ」が押せるようになり、押すと送る。失敗したら理由を平易な 1 文で出し、入れた数字は残す
// （1 桁だけ直して送り直せるように）。つながると親のホームへ切り替わる（App.tsx）。
// 入力の状態と「つなぐ」を押せるかは src/domain/pairingInput.ts が決める（断られた番号は数字を変えるまで送れない）。

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import { useSession } from "../../data/session";
import { INVITE_CODE_LENGTH, redeemMessage } from "../../domain/pairing";
import {
  beginSend,
  canSend,
  eraseDigit,
  finishSend,
  initialPairingInput,
  pressDigit,
  type SendFailure,
} from "../../domain/pairingInput";
import {
  colors,
  font,
  lineHeight,
  pressedOpacity,
  radius,
  space,
  textStyle,
} from "../../theme";

const KEY_ROWS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["0"]];

const SEND_ERROR = "送れませんでした。電波のよい所で、もう一度入れてください。";

function failureMessage(failure: SendFailure): string {
  return failure === "send_error" ? SEND_ERROR : redeemMessage(failure);
}

export default function ParentPairingScreen() {
  const { redeemInvite } = useSession();
  const [input, setInput] = useState(initialPairingInput);
  // 「つなぐ」を押せるかの判定に使う時刻。待つ窓が明けたときに進める。
  const [now, setNow] = useState(() => Date.now());
  const { code, busy, failure, lockedUntil } = input;
  const message = failure ? failureMessage(failure) : null;

  useEffect(() => {
    if (lockedUntil === null) return;
    const wait = Math.max(0, lockedUntil - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const submit = () => {
    const t = Date.now();
    const next = beginSend(input, t);
    if (next === input) return;
    setInput(next);
    setNow(t);
    redeemInvite(next.code)
      .then((r) => setInput((s) => finishSend(s, r.reason, Date.now())))
      .catch((e: unknown) => {
        console.warn("番号を送れませんでした", e);
        setInput((s) => finishSend(s, "send_error", Date.now()));
      });
  };

  const press = (digit: string) => setInput((s) => pressDigit(s, digit));

  const erase = () => setInput(eraseDigit);

  return (
    <Screen scroll>
      <Text style={styles.lead}>
        子のスマホに出ている 6 桁の番号を入れてください
      </Text>
      <Text style={styles.note}>
        はじめの設定です。子どもがこのスマホで入れます。
      </Text>

      <View
        style={styles.slots}
        accessibilityLabel={`入れた番号 ${code.split("").join(" ")}`}
      >
        {Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => (
          <View key={i} style={styles.slot}>
            <Text style={styles.slotText}>{code[i] ?? ""}</Text>
          </View>
        ))}
      </View>

      <View accessibilityLiveRegion="assertive">
        {message ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {message}
          </Text>
        ) : null}
      </View>

      {KEY_ROWS.map((row) => (
        <View key={row.join("")} style={styles.keyRow}>
          {row.map((d) => (
            <Pressable
              key={d}
              onPress={() => press(d)}
              accessibilityRole="button"
              accessibilityLabel={d}
              style={({ pressed }) => [
                styles.key,
                pressed && { opacity: pressedOpacity.button },
              ]}
            >
              <Text style={styles.keyText}>{d}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={styles.actions}>
        <View style={styles.action}>
          <BigButton label="消す" emoji="⌫" onPress={erase} disabled={busy} />
        </View>
        <View style={styles.action}>
          <BigButton
            label="つなぐ"
            variant="primary"
            onPress={submit}
            disabled={!canSend(input, now)}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { ...textStyle.bodyStrong, lineHeight: lineHeight.body },
  note: { ...textStyle.caption, marginTop: space.xs, marginBottom: space.md },
  slots: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  slot: {
    width: 46,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: { fontSize: font.title, fontWeight: "800", color: colors.text },
  error: {
    ...textStyle.bodyStrong,
    color: colors.danger,
    lineHeight: lineHeight.body,
    marginBottom: space.sm,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.sm,
  },
  key: {
    flex: 1,
    maxWidth: 104,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: font.title, fontWeight: "700", color: colors.text },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  action: { flex: 1 },
});
