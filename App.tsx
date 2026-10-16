import { StatusBar } from "expo-status-bar";
import {
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { APP_NAME } from "./src/constants";
import { backend } from "./src/data/backendInstance";
import { usePushNotifications } from "./src/data/pushTokens";
import { SessionProvider, useSession } from "./src/data/session";
import { StoreProvider } from "./src/data/store";
import { RootStackParamList } from "./src/navigation/types";
import { colors, textStyle } from "./src/theme";
import LoadingScreen from "./src/screens/LoadingScreen";
import RoleSelectScreen from "./src/screens/RoleSelectScreen";
import ChildPairingScreen from "./src/screens/pairing/ChildPairingScreen";
import ParentPairingScreen from "./src/screens/pairing/ParentPairingScreen";
import ParentHomeScreen from "./src/screens/parent/ParentHomeScreen";
import CategorySelectScreen from "./src/screens/parent/CategorySelectScreen";
import ParentStatusScreen from "./src/screens/parent/ParentStatusScreen";
import ChildInboxScreen from "./src/screens/child/ChildInboxScreen";
import ConsultationDetailScreen from "./src/screens/child/ConsultationDetailScreen";
import type { PushRoute } from "./src/domain/push";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// 通知を押したら相談の画面を開く（画面の組がまだ用意できていなければ開かない）。
function openFromNotification(route: PushRoute) {
  if (!navigationRef.isReady()) return;
  if (route.name === "ParentStatus")
    navigationRef.navigate("ParentStatus", route.params);
  else navigationRef.navigate("ConsultationDetail", route.params);
}

// つながったあと、通知のトークンを保存し、通知から相談を開く（開発ビルドの実機だけ。pushTokens.ts）。
function PushNotifications() {
  const session = useSession();
  const paired =
    session.status === "paired"
      ? { role: session.role, pairId: session.pairId }
      : null;
  usePushNotifications(backend, paired, openFromNotification);
  return null;
}

// サインインとペアの状態で、出す画面の組を切り替える（状態が変わると、その組の最初の画面へ移る）。
function RootNavigator() {
  const session = useSession();
  if (session.status === "loading") return <LoadingScreen />;
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: textStyle.bodyStrong,
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {session.status === "choose_role" ? (
        <Stack.Screen
          name="RoleSelect"
          component={RoleSelectScreen}
          options={{ title: APP_NAME }}
        />
      ) : session.status === "child_unpaired" ? (
        <Stack.Screen
          name="ChildPairing"
          component={ChildPairingScreen}
          options={{ title: "親のスマホとつなぐ" }}
        />
      ) : session.status === "parent_unpaired" ? (
        <Stack.Screen
          name="ParentPairing"
          component={ParentPairingScreen}
          options={{ title: "子のスマホとつなぐ" }}
        />
      ) : session.role === "parent" ? (
        <>
          <Stack.Screen
            name="ParentHome"
            component={ParentHomeScreen}
            options={{ title: "" }}
          />
          <Stack.Screen
            name="CategorySelect"
            component={CategorySelectScreen}
            options={{ title: "相談する" }}
          />
          <Stack.Screen
            name="ParentStatus"
            component={ParentStatusScreen}
            // 戻るは画面内の「ホームにもどる」に一本化する。Web では headerBackVisible が効かないので headerLeft も消す。
            options={{
              title: "",
              headerBackVisible: false,
              headerLeft: () => null,
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="ChildInbox"
            component={ChildInboxScreen}
            options={{ title: "親からの相談" }}
          />
          <Stack.Screen
            name="ConsultationDetail"
            component={ConsultationDetailScreen}
            options={{ title: "相談の内容" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StoreProvider>
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
          </NavigationContainer>
          <PushNotifications />
          <StatusBar style="dark" />
        </StoreProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
