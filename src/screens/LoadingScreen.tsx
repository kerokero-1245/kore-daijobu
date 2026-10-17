// 起動中（サインインして役割とペアを読んでいる間）の画面。読めなかったら理由と「もう一度」を出す。
// 設定が無いとき（fatal）は、ためしても直らないので理由だけを出す。

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Screen from "../components/Screen";
import BigButton from "../components/BigButton";
import RepairLink from "../components/RepairLink";
import { useSession } from "../data/session";
import { colors, lineHeight, space, textStyle } from "../theme";

export default function LoadingScreen() {
  const session = useSession();
  const error = session.status === "loading" ? session.error : undefined;
  const fatal = session.status === "loading" && session.fatal === true;
  return (
    <Screen>
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            {fatal ? null : (
              <BigButton
                label="もう一度"
                variant="primary"
                onPress={session.retry}
              />
            )}
            {fatal ? null : <RepairLink />}
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.primaryEdge} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  error: {
    ...textStyle.body,
    textAlign: "center",
    lineHeight: lineHeight.body,
    marginBottom: space.lg,
  },
});
