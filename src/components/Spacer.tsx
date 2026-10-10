// 余白だけの View。大きさは space の段の名前で選ぶ。

import React from "react";
import { View } from "react-native";
import { space } from "../theme";

interface Props {
  size: keyof typeof space;
}

export default function Spacer({ size }: Props) {
  return <View style={{ height: space[size] }} />;
}
