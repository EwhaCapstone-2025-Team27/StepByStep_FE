import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { quizApi } from '../lib/apiClient';

const { width, height } = Dimensions.get('window');

const FALLBACK = [
  { label: '피임', size: 290, color: '#eadff6ff', x: 60, y: 50 },
  { label: '생리', size: 170, color: '#cc85f5ff', x: 30, y: 22 },
  { label: '연애', size: 230, color: '#842fb9ff', x: 60, y: 87 },
  { label: '신체 변화', size: 130, color: '#C084FC', x: 25, y: 70 },
  { label: '젠더', size: 140, color: '#c652e3ff', x: 75, y: 25 },
];

export default function KeywordScenarioScreen() {
  const [bubbles, setBubbles] = useState(FALLBACK);

  useEffect(() => {
    (async () => {
      try {
        const { keywords = [] } = await quizApi.getKeywords(); // ← BE 호출
        if (Array.isArray(keywords) && keywords.length) {
          const mapped = keywords.slice(0, 5).map((k, i) => ({
            ...FALLBACK[i % FALLBACK.length],
            label: k,
          }));
          setBubbles(mapped);
        }
      } catch {
        // 무시하고 폴백 데이터를 사용합니다.
      }
    })();
  }, []);

  const onPressKeyword = (kw) =>
    router.push({ pathname: '/scenario', params: { keyword: kw, mode: 'keyword' } });

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.container}>
        {bubbles.map((b) => {
          const left = (b.x / 100) * width - b.size / 2;
          const top = (b.y / 100) * height - b.size / 2 - 100;
          return (
            <TouchableOpacity
              key={b.label}
              activeOpacity={0.85}
              onPress={() => onPressKeyword(b.label)}
              style={[S.bubble, { width: b.size, height: b.size, backgroundColor: b.color, left, top }]}
            >
              <Text style={S.text}>{b.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  container: { flex: 1, position: 'relative' },
  bubble: {
    position: 'absolute',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  text: { fontFamily: 'PretendardBold', fontSize: 18, color: '#111827', textAlign: 'center' },
});