import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { AppProvider, usePalette } from '@/state/app';

SplashScreen.preventAutoHideAsync();

function Splash() {
  const p = usePalette();
  return <View style={{ flex: 1, backgroundColor: p.bg }} />;
}

function Navigation() {
  const p = usePalette();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  const base = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: p.bg, card: p.bg, text: p.text, border: p.rule, primary: p.brand } };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: p.bg },
          headerTintColor: p.text,
          headerTitleStyle: { fontFamily: 'Newsreader-SemiBold', fontSize: 20 },
          contentStyle: { backgroundColor: p.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="article/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="edition/[id]" options={{ title: '' }} />
        <Stack.Screen name="category/[id]" options={{ title: '' }} />
        <Stack.Screen name="concept/[id]" options={{ title: '' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    'Newsreader-Regular': require('../../assets/fonts/Newsreader_400Regular.ttf'),
    'Newsreader-Italic': require('../../assets/fonts/Newsreader_400Regular_Italic.ttf'),
    'Newsreader-Medium': require('../../assets/fonts/Newsreader_500Medium.ttf'),
    'Newsreader-SemiBold': require('../../assets/fonts/Newsreader_600SemiBold.ttf'),
    'Newsreader-Bold': require('../../assets/fonts/Newsreader_700Bold.ttf'),
    MastheadJP: require('../../assets/fonts/MastheadJP-Bold.ttf'),
  });
  if (!loaded) return null;
  return (
    <AppProvider fallback={<Splash />}>
      <Navigation />
    </AppProvider>
  );
}
