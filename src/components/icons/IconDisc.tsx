// 丸い台に載せた絵（役割のボタン・種類の行・待ちの画面などで同じ形を使う）。
// 台の直径（size）と絵の大きさ（iconSize）、台の色（bg）を渡す。

import React from "react";
import { StyleSheet, View } from "react-native";

import type { IconName } from "../../types";
import Icon from "./Icon";

interface Props {
  name: IconName;
  size: number;
  iconSize: number;
  bg: string;
}

export default function IconDisc({ name, size, iconSize, bg }: Props) {
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Icon name={name} size={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
