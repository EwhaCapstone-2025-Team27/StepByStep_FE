// app/_layout.js
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync(); // 폰트 로드 전 스플래시 유지

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // 화면들에서 쓰는 이름과 맞춤 (Pretendard*)
    PretendardBold: require('../assets/fonts/Bold.ttf'),
    PretendardMedium: require('../assets/fonts/Medium.ttf'),
    PretendardRegular: require('../assets/fonts/Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,            // 기본 헤더 전부 숨김
        // (참고) 만약 일부 화면만 켜고 싶으면 개별 <Stack.Screen>에 options로 headerShown: true 설정
        // headerTitleStyle: { fontFamily: 'PretendardBold' }, // 헤더 쓸 일이 생기면 주석 해제
      }}
    />
  );
}