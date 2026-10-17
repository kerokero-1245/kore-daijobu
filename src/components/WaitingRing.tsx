// 親の「相談しています…」の画面の、子の絵のまわりを回る輪。
// 淡い橙の輪の上を、濃い橙の 4 分の 1 の弧がゆっくり回る。動きを減らす設定の端末では回さない。

import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "../theme";
import type { IconName } from "../types";
import IconDisc from "./icons/IconDisc";

// 輪の直径・太さ・1 周の時間と、中の台と絵の大きさ。
const RING = 168;
const STROKE = 10;
const TURN_MS = 1600;
const DISC = 128;
const ICON = 92;

interface Props {
  icon: IconName;
}

// 飾りなので読み上げから外す（「相談しています…」は隣の見出しが伝える）。
export default function WaitingRing({ icon }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (v) => alive && setReduce(v),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: TURN_MS,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const r = RING / 2 - STROKE / 2 - 1;
  const mid = RING / 2;
  return (
    <View style={styles.wrap} aria-hidden>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
      >
        <Svg
          width={RING}
          height={RING}
          viewBox={`0 0 ${RING} ${RING}`}
          fill="none"
        >
          <Circle
            cx={mid}
            cy={mid}
            r={r}
            stroke={colors.orangeSoft}
            strokeWidth={STROKE}
          />
          <Path
            d={`M${mid} ${mid - r}a${r} ${r} 0 0 1 ${r} ${r}`}
            stroke={colors.primaryEdge}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      <IconDisc name={icon} size={DISC} iconSize={ICON} bg={colors.greenSoft} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
});
