/**
 * FlickSwipe App
 *
 * Main entry point for the FlickSwipe application.
 * Sets up navigation, gesture handler, and providers.
 *
 * Features:
 * - Solo-first design with quick entry to swiping
 * - Group mode for movie nights with friends
 * - First-time onboarding flow
 * - AppModeContext for mode management
 */

import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar, View, StyleSheet, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from './src/types';
import { COLORS } from './src/constants';
import { AppModeProvider } from './src/context/AppModeContext';

// Screens - Solo Mode
import HomeScreenSolo from './src/screens/HomeScreenSolo';
import SoloSwipeDeckScreen from './src/screens/SoloSwipeDeckScreen';
import SoloWatchlistScreen from './src/screens/SoloWatchlistScreen';
import OnboardingScreen, { ONBOARDING_COMPLETE_KEY } from './src/screens/OnboardingScreen';

// Screens - Group Mode
import RoomLobbyScreen from './src/screens/RoomLobbyScreen';
import SwipeDeckScreen from './src/screens/SwipeDeckScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';

// Keep splash screen visible while we load resources
SplashScreen.preventAutoHideAsync();

// ============================================================================
// NAVIGATION THEME
// ============================================================================

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.backgroundCard,
    text: COLORS.textPrimary,
    border: 'rgba(255,255,255,0.1)',
    notification: COLORS.primary,
  },
};

// ============================================================================
// NAVIGATION STACK
// ============================================================================

const Stack = createNativeStackNavigator<RootStackParamList>();

// ============================================================================
// APP COMPONENT
// ============================================================================

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Prepare app resources
  useEffect(() => {
    async function prepare() {
      try {
        // Check if onboarding has been completed
        const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        setShowOnboarding(onboardingComplete !== 'true');
        setOnboardingChecked(true);

        // Add any other initialization logic here (fonts, initial data, etc.)
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (e) {
        console.warn(e);
        setOnboardingChecked(true);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Hide splash screen when ready
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && onboardingChecked) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, onboardingChecked]);

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  if (!appIsReady || !onboardingChecked) {
    return (
      <View style={styles.splashContainer}>
        <LinearGradient
          colors={[COLORS.background, COLORS.backgroundLight]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.splashEmoji}>🎬</Text>
        <Text style={styles.splashText}>FlickSwipe</Text>
      </View>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <AppModeProvider>
        <NavigationContainer theme={DarkTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: COLORS.background },
            }}
          >
            {/* ============================================================ */}
            {/* SOLO MODE SCREENS (Default Flow) */}
            {/* ============================================================ */}

            <Stack.Screen
              name="Home"
              component={HomeScreenSolo}
              options={{ animation: 'fade' }}
            />

            <Stack.Screen
              name="SoloSwipeDeck"
              component={SoloSwipeDeckScreen}
              options={{
                animation: 'fade',
                gestureEnabled: false, // Prevent back gesture during swiping
              }}
            />

            <Stack.Screen
              name="SoloWatchlist"
              component={SoloWatchlistScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* ============================================================ */}
            {/* GROUP MODE SCREENS */}
            {/* ============================================================ */}

            <Stack.Screen
              name="RoomLobby"
              component={RoomLobbyScreen}
              options={{ animation: 'slide_from_bottom' }}
            />

            <Stack.Screen
              name="SwipeDeck"
              component={SwipeDeckScreen}
              options={{
                animation: 'fade',
                gestureEnabled: false, // Prevent back gesture during swiping
              }}
            />

            <Stack.Screen
              name="Watchlist"
              component={WatchlistScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AppModeProvider>
    </GestureHandlerRootView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  splashText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
});
