// 親のスマホ: 子のスマホに出ている 6 桁の番号を入れる。最初の設定として、子が親のスマホで打つ前提。
// 6 桁入れて「つなぐ」を押すと送る。「つなぐ」は押せるままにし、送れない状態（6 桁そろっていない・待つ窓の間・
// 断られた番号のまま）で押したら、送らずに理由を出す（子の返信の「送る」と同じ作法）。
// 失敗したら理由を平易な 1 文で出し、入れた数字は残す
// （1 桁だけ直して送り直せるように）。「消す」は 1 タップで 1 桁、長押しで全部消す。つながると親のホームへ切り替わる（App.tsx）。
// 入力の状態と「つなぐ」を押せるかは src/domain/pairingInput.ts が決める（断られた番号は数字を変えるまで送れない）。
// 低い画面でも「つなぐ」と「消す」がスクロール無しで見えるよう、キーの高さと余白は表示域の高さから決める
// （src/domain/keypadLayout.ts）。失敗の理由は説明文の場所に出して、全体の高さを変えない。

import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Screen from "../../components/Screen";
import BigButton from "../../components/BigButton";
import Icon from "../../components/icons/Icon";
import { useSession } from "../../data/session";
import { keypadLayout } from "../../domain/keypadLayout";
import { INVITE_CODE_LENGTH, redeemMessage } from "../../domain/pairing";
import {
  beginSend,
  eraseAll,
  eraseDigit,
  finishSend,
  initialPairingInput,
  pressDigit,
  sendBlockMessage,
  type SendFailure,
} from "../../domain/pairingInput";
import {
  borderWidth,
  colors,
  font,
  layout,
  lift,
  liftShadow,
  lineHeight,
  pressLook,
  pressedOpacity,
  radius,
  space,
  textStyle,
  tone,
} from "../../theme";

// 数字キーの並び（電話と同じ）。4 段目は 空き・0・消す（ERASE）。
const ERASE = "erase";
const BLANK = "";
const KEY_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [BLANK, "0", ERASE],
];

const SEND_ERROR = "送れませんでした。電波のよい所で、もう一度入れてください。";

function failureMessage(failure: SendFailure): string {
  return failure === "send_error" ? SEND_ERROR : redeemMessage(failure);
}

export default function ParentPairingScreen() {
  const { redeemInvite } = useSession();
  const [input, setInput] = useState(initialPairingInput);
  // 送れるかの判定に使う時刻。待つ窓が明けたときに進める。
  const [now, setNow] = useState(() => Date.now());
  const { code, busy, failure, lockedUntil } = input;
  // 送れない状態で押したときの理由を、送った結果の失敗より先に出す。
  const message =
    sendBlockMessage(input, now) ?? (failure ? failureMessage(failure) : null);
  // 表示域（ヘッダーの下）の高さと、説明文（理由が出ていないとき）の高さ。キーの高さを決めるのに使う。
  const [viewport, setViewport] = useState<number | null>(null);
  const [descHeight, setDescHeight] = useState<number | null>(null);
  const metrics = keypadLayout(viewport ?? Infinity, descHeight ?? 0);

  useEffect(() => {
    if (lockedUntil === null) return;
    const wait = Math.max(0, lockedUntil - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const submit = () => {
    const t = Date.now();
    const next = beginSend(input, t);
    setInput(next);
    setNow(t);
    if (!next.busy) {
      // iOS は画面の変化を自動では読み上げないので、送れない理由を読み上げに通知する。
      // （Android は下の live region、Web は role="alert" で読み上げられる）
      const reason = sendBlockMessage(next, t);
      if (reason && Platform.OS === "ios")
        AccessibilityInfo.announceForAccessibility(reason);
      return;
    }
    redeemInvite(next.code)
      .then((r) => setInput((s) => finishSend(s, r.reason, Date.now())))
      .catch((e: unknown) => {
        console.warn("番号を送れませんでした", e);
        setInput((s) => finishSend(s, "send_error", Date.now()));
      });
  };

  const press = (digit: string) => setInput((s) => pressDigit(s, digit));

  const erase = () => setInput(eraseDigit);

  const key = { minHeight: metrics.keyHeight };
  return (
    <Screen scroll padY={metrics.pad} onViewportHeight={setViewport}>
      <View style={{ gap: metrics.gap }}>
        {/* 説明文の場所。理由が出たら説明文に替えて出し、高さは説明文のときのまま保つ。
            外側は常に置いておき、中身が変わったら Android が読み上げる（live region） */}
        <View
          accessibilityLiveRegion="assertive"
          style={message && descHeight ? { minHeight: descHeight } : null}
          onLayout={
            message
              ? undefined
              : (e) => setDescHeight(e.nativeEvent.layout.height)
          }
        >
          {message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          ) : (
            <>
              <Text style={styles.lead}>
                子のスマホに出ている番号を、6 桁入れて「つなぐ」を押してください
              </Text>
              <Text style={styles.note}>
                はじめの設定です。子どもがこのスマホで入れます。
              </Text>
            </>
          )}
        </View>

        <View
          style={styles.slots}
          accessibilityLabel={`入れた番号 ${code.split("").join(" ")}`}
        >
          {Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => (
            <View key={i} style={[styles.slot, { height: metrics.slotHeight }]}>
              <Text style={styles.slotText}>{code[i] ?? ""}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: metrics.keyGap }}>
          {KEY_ROWS.map((row) => (
            <View
              key={row.join("-")}
              style={[styles.keyRow, { gap: metrics.keyGap }]}
            >
              {row.map((d) =>
                d === BLANK ? (
                  <View key="blank" style={styles.keySpace} />
                ) : d === ERASE ? (
                  <Pressable
                    key={d}
                    onPress={erase}
                    onLongPress={() => setInput(eraseAll)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="消す"
                    accessibilityHint="押すと 1 桁消す。長押しで全部消す"
                    accessibilityState={{ disabled: busy }}
                    style={({ pressed }) => [
                      styles.key,
                      styles.eraseKey,
                      key,
                      { opacity: pressLook(busy, pressed).opacity },
                    ]}
                  >
                    <Icon name="erase" size={30} />
                    <Text style={styles.eraseText}>消す</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    key={d}
                    onPress={() => press(d)}
                    accessibilityRole="button"
                    accessibilityLabel={d}
                    style={({ pressed }) => [
                      styles.key,
                      key,
                      pressed && { opacity: pressedOpacity.button },
                    ]}
                  >
                    <Text style={styles.keyText}>{d}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ))}
        </View>

        <BigButton
          label="つなぐ"
          icon="connect"
          center
          variant="primary"
          minHeight={metrics.buttonHeight}
          onPress={submit}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { ...textStyle.bodyStrong, lineHeight: lineHeight.body },
  note: {
    ...textStyle.caption,
    lineHeight: lineHeight.small,
    marginTop: space.xs,
  },
  error: {
    ...textStyle.bodyStrong,
    color: colors.danger,
    lineHeight: lineHeight.body,
  },
  slots: { flexDirection: "row", gap: space.s },
  slot: {
    flex: 1,
    borderRadius: radius.slot,
    borderWidth: borderWidth.normal,
    borderColor: colors.primaryEdge,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: { fontSize: font.title, fontWeight: "800", color: colors.text },
  keyRow: { flexDirection: "row" },
  keySpace: { flex: 1 },
  key: {
    flex: 1,
    borderRadius: radius.key,
    borderWidth: borderWidth.normal,
    borderColor: tone.card.edge,
    backgroundColor: tone.card.bg,
    alignItems: "center",
    justifyContent: "center",
    ...liftShadow(lift.sm, tone.card.shade),
  },
  keyText: { fontSize: font.title, fontWeight: "700", color: colors.text },
  eraseKey: {
    ...layout.centerRow,
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: colors.orangeSoft,
  },
  eraseText: { ...textStyle.bodyStrong },
});
