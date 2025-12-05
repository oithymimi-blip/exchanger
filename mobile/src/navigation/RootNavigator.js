import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View, Text, StyleSheet, Pressable } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../stores/authStore'
import { useAuthHydration } from '../hooks/useAuthHydration'
import { colors } from '../theme'
import { LoginScreen } from '../screens/LoginScreen'
import { SignupScreen } from '../screens/SignupScreen'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { DashboardScreen } from '../screens/DashboardScreen'
import { HistoryScreen } from '../screens/HistoryScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { AccountInfoScreen } from '../screens/AccountInfoScreen'
import { ComingSoonScreen } from '../screens/ComingSoonScreen'
import { FeatureDemoScreen } from '../screens/FeatureDemoScreen'
import { UserHomeScreen } from '../screens/UserHomeScreen'
import { VerificationScreen } from '../screens/VerificationScreen'

const TAB_ACTIVE = '#1877F2'
const TAB_INACTIVE = '#7B859B'

const tabBarStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 2,
    backgroundColor: 'transparent'
  },
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: '#D7DEEF',
    backgroundColor: '#FFFFFFF2'
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6
  },
  tabItemPressed: {
    backgroundColor: '#EEF3FF'
  },
  iconBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconBadgeActive: {
    backgroundColor: 'transparent'
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: TAB_INACTIVE
  },
  tabLabelActive: {
    color: TAB_ACTIVE,
    fontWeight: '700'
  },
  indicator: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: TAB_ACTIVE,
    opacity: 0.7
  },
  indicatorHidden: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent'
  }
})

function FancyTabBar({ state, descriptors, navigation, iconConfig }) {
  const insets = useSafeAreaInsets()
  const paddingBottom = Math.max(insets.bottom, 8)

  return (
    <View style={[tabBarStyles.container, { paddingBottom }]}>
      <View style={tabBarStyles.surface}>
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const { options } = descriptors[route.key]
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name

          const iconMeta = iconConfig[route.name] || { name: 'circle-outline', size: 20 }
          const iconSize = focused ? iconMeta.size : Math.max(iconMeta.size - 1, 16)

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true
            })

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key
            })
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              hitSlop={12}
              style={({ pressed }) => [
                tabBarStyles.tabItem,
                pressed && tabBarStyles.tabItemPressed
              ]}
            >
              <View style={[tabBarStyles.iconBadge, focused && tabBarStyles.iconBadgeActive]}>
                <MaterialCommunityIcons
                  name={iconMeta.name}
                  size={iconSize}
                  color={focused ? TAB_ACTIVE : TAB_INACTIVE}
                />
              </View>
              <Text style={[tabBarStyles.tabLabel, focused && tabBarStyles.tabLabelActive]}>
                {label}
              </Text>
              <View style={focused ? tabBarStyles.indicator : tabBarStyles.indicatorHidden} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const AuthStack = createNativeStackNavigator()
const HomeStack = createNativeStackNavigator()
const AppTabs = createBottomTabNavigator()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1877F2',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1E2329',
    border: '#EAECEF',
    notification: '#1877F2'
  }
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#0f172a',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#ffffff' }
      }}
    >
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerTitle: 'Sign in' }}
      />
      <AuthStack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ headerTitle: 'Create account' }}
      />
      <AuthStack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ headerTitle: 'Reset password' }}
      />
    </AuthStack.Navigator>
  )
}

function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#ffffff' }
      }}
    >
      <HomeStack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="UserHome"
        component={UserHomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="AccountInfo"
        component={AccountInfoScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="Verification"
        component={VerificationScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="FeatureDemo"
        component={FeatureDemoScreen}
        options={({ route }) => ({
          title: route?.params?.title ?? 'Preview'
        })}
      />
    </HomeStack.Navigator>
  )
}

function AppNavigator() {
  const iconConfig = {
    Home: { name: 'home-variant', size: 22 },
    Markets: { name: 'chart-line', size: 20 },
    Trade: { name: 'swap-horizontal-bold', size: 23 },
    Futures: { name: 'file-chart', size: 20 },
    Assets: { name: 'wallet-outline', size: 21 }
  }

  return (
    <AppTabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FancyTabBar {...props} iconConfig={iconConfig} />}
    >
      <AppTabs.Screen name="Home" component={HomeStackScreen} options={{ headerShown: false }} />
      <AppTabs.Screen
        name="Markets"
        component={HistoryScreen}
        options={{ headerShown: false }}
      />
      <AppTabs.Screen
        name="Trade"
        component={ComingSoonScreen}
        initialParams={{
          title: 'Trade like a pro',
          subtitle: 'Spot, margin, and strategy builders are arriving soon.',
          icon: 'repeat'
        }}
      />
      <AppTabs.Screen
        name="Futures"
        component={ComingSoonScreen}
        initialParams={{
          title: 'Futures desk incoming',
          subtitle: 'We are building advanced derivatives tooling.',
          icon: 'trending-up'
        }}
      />
      <AppTabs.Screen
        name="Assets"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </AppTabs.Navigator>
  )
}

export function RootNavigator() {
  const token = useAuth(state => state.token)
  const hydrated = useAuthHydration()

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <NavigationContainer theme={navTheme}>
      {token ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
