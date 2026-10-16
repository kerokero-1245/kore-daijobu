// 起動中（サインインして役割とペアを読んでいる間）の画面。読めなかったら理由と「もう一度」を出す。

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Screen from "../components/Screen";
import BigButton from "../components/BigButton";
import { useSession } from "../data/session";
import { colors, lineHeight, space, textStyle } from "../theme";

export default function LoadingScreen() {
  const session = useSession();
  const error = session.status === "loading" ? session.error : undefined;
  return (
    <Screen>
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <BigButton
              label="もう一度"
              variant="primary"
              onPress={session.retry}
            />
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
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
