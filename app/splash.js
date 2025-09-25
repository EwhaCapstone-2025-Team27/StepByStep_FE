// app/splash.js
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SplashScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/login');
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.centerWrap}
        onPress={() => router.replace('/login')}
        activeOpacity={0.8}
      >
        {/* 로고 텍스트 */}
        <View style={styles.textBox}>
          <Text style={styles.title}>성큼성큼</Text>
          <Text style={styles.subtitle}>청소년이 성 지식에 한 걸음 더</Text>
        </View>

        {/* 캐릭터 이미지 */}
        <Image
          source={require('../image/img/scsc5.png')}
          style={styles.character}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e4c9ebff',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center', // 세로 중앙
    alignItems: 'center',     // 가로 중앙
  },
  textBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'PretendardBold',
    fontSize: 36,
    color: '#111827',
  },
  subtitle: {
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  character: {
    width: 200,
    height: 200,
  },
});