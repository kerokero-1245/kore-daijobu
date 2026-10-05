import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider } from './src/data/store';
import { RootStackParamList } from './src/navigation/types';
import { colors, font } from './src/theme';
import RoleSelectScreen from './src/screens/RoleSelectScreen';
import ParentHomeScreen from './src/screens/parent/ParentHomeScreen';
import CategorySelectScreen from './src/screens/parent/CategorySelectScreen';
import ParentStatusScreen from './src/screens/parent/ParentStatusScreen';
import ChildInboxScreen from './src/screens/child/ChildInboxScreen';
import ConsultationDetailScreen from './src/screens/child/ConsultationDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="RoleSelect"
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontSize: font.body, fontWeight: '700', color: colors.text },
              headerTintColor: colors.primary,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen
              name="RoleSelect"
              component={RoleSelectScreen}
              options={{ title: 'これ、大丈夫？（開発用）' }}
            />
            <Stack.Screen name="ParentHome" component={ParentHomeScreen} options={{ title: '' }} />
            <Stack.Screen
              name="CategorySelect"
              component={CategorySelectScreen}
              options={{ title: '相談する' }}
            />
            <Stack.Screen
              name="ParentStatus"
              component={ParentStatusScreen}
              // 戻るは画面内の「ホームにもどる」に一本化する。Web では headerBackVisible が効かないので headerLeft も消す。
              options={{ title: '', headerBackVisible: false, headerLeft: () => null }}
            />
            <Stack.Screen
              name="ChildInbox"
              component={ChildInboxScreen}
              options={{ title: '親からの相談' }}
            />
            <Stack.Screen
              name="ConsultationDetail"
              component={ConsultationDetailScreen}
              options={{ title: '相談の内容' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </StoreProvider>
    </SafeAreaProvider>
  );
}