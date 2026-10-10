// 続けて押されても 1 回だけ実行する（画面が切り替わる前の 2 回目以降は無視）。
//   const once = useOnce();
//   const onPress = () => once(() => navigation.navigate(...));
// resetOnFocus を付けると、この画面に戻ってきた（フォーカスが戻った）ら、また実行できるようにする。

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { createOnce } from "../domain/once";

export default function useOnce(
  options: { resetOnFocus?: boolean } = {},
): (fn: () => void) => void {
  const { resetOnFocus = false } = options;
  const [once] = useState(createOnce);
  useFocusEffect(
    useCallback(() => {
      if (resetOnFocus) once.reset();
    }, [once, resetOnFocus]),
  );
  return once.run;
}
