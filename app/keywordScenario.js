// app/keywordScenario.js
import { router } from 'expo-router';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

// 배치 좌표: 퍼센트로 지정 → 원래 예시 이미지처럼 배치
const BUBBLES = [
  { label: '피임', size: 290, color: '#E9D5FF', x: 60, y: 50 },
  { label: '생리', size: 170, color: '#FBCFE8', x: 30, y: 22 },
  { label: '연애', size: 230, color: '#D946EF', x: 60, y: 87 },
  { label: '신체 변화', size: 130, color: '#C084FC', x: 25, y: 70 },
  { label: '젠더', size: 140, color: '#F5D0FE', x: 75, y: 25 },
];

export default function KeywordScenarioScreen() {
  const onPressKeyword = (kw) => {
    router.push({ pathname: '/scenario', params: { keyword: kw, mode: 'keyword' } });
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.container}>
        {BUBBLES.map((b) => {
          const left = (b.x / 100) * width - b.size / 2;
          const top = (b.y / 100) * height - b.size / 2 - 100; // SafeArea 고려
          return (
            <TouchableOpacity
              key={b.label}
              activeOpacity={0.85}
              onPress={() => onPressKeyword(b.label)}
              style={[
                S.bubble,
                {
                  width: b.size,
                  height: b.size,
                  backgroundColor: b.color,
                  left,
                  top,
                },
              ]}
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
  text: {
    fontFamily: 'PretendardBold',
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
  },
});