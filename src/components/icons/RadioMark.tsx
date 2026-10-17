// 選択肢の印（ラジオの丸）。外周の輪を描き、選ばれているときは中を塗る。
// 文字の「●」「○」はフォントで形と太さが変わるので使わず、ここの絵を使う。
// 印は飾りなので読み上げからは外す（選ばれているかは押せる部品の aria-checked が伝える）。

import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface Props {
  selected: boolean;
  color: string;
  size: number;
}

export default function RadioMark({ selected, color, size }: Props) {
  return (
    <View aria-hidden style={{ width: size, height: size, flexShrink: 0 }}>
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={color}
          strokeWidth={2.5}
        />
        {selected ? <Circle cx="12" cy="12" r="5.5" fill={color} /> : null}
      </Svg>
    </View>
  );
}
