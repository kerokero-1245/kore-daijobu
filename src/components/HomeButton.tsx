// 「ホームにもどる」ボタン（親の答えの画面で、見つからない・答え・相談中のどの分岐でも同じもの）。

import React from "react";
import BigButton from "./BigButton";

interface Props {
  onPress: () => void;
}

export default function HomeButton({ onPress }: Props) {
  return (
    <BigButton label="ホームにもどる" variant="primary" onPress={onPress} />
  );
}
