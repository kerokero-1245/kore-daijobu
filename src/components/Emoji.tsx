// 文字の横に置く絵文字。大きさは font の段（title / huge）で選び、右に space.md の余白を取る。

import React from "react";
import { StyleSheet, Text } from "react-native";
import { font, space } from "../theme";

interface Props {
  children: string;
  size?: "title" | "huge";
}

export default function Emoji({ children, size = "title" }: Props) {
  return <Text style={styles[size]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: font.title, marginRight: space.md },
  huge: { fontSize: font.huge, marginRight: space.md },
});
