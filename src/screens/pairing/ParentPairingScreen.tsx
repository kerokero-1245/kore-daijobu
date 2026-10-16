// 親のスマホ: 子のスマホに出ている 6 桁の番号を入れる。最初の設定として、子が親のスマホで打つ前提。
// 6 桁そろうと自動で送り、失敗したら理由を平易な 1 文で出す。つながると親のホームへ切り替わる（App.tsx）。

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import RestartLink from "../../components/RestartLink";
import { useSession } from "../../data/session";
import { INVITE_CODE_LENGTH, redeemMessage } from "../../domain/pairing";
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

export default function ParentPairingScreen() {
  const { redeemInvite } = useSession();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (full: string) => {
    setBusy(true);
    redeemInvite(full)
      .then((r) => {
        if (r.reason === "ok") return;
        setMessage(redeemMessage(r.reason));
        setCode("");
      })
      .catch((e: unknown) => {
        console.warn("番号を送れませんでした", e);
        setMessage(SEND_ERROR);
        setCode("");
      })
      .finally(() => setBusy(false));
  };

  const press = (digit: string) => {
    if (busy || code.length >= INVITE_CODE_LENGTH) return;
    const next = code + digit;
    setCode(next);
    setMessage(null);
    if (next.length === INVITE_CODE_LENGTH) submit(next);
  };

  const erase = () => {
    if (busy) return;
    setCode((c) => c.slice(0, -1));
  };

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
      <View style={styles.erase}>
        <BigButton label="消す" emoji="⌫" onPress={erase} />
      </View>
      <RestartLink />
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
  erase: { marginTop: space.md },
});
