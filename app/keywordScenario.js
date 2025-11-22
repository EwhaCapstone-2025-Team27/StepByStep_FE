import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { quizApi } from '../lib/apiClient';

const PALETTE = ['#eadff6ff', '#e8beff', '#a139d5', '#d084fc', '#c652e3ff'];
const FALLBACK = [
  { id: 3, title: '건강한 성관계' },
  { id: 4, title: '성에 대한 올바른 이해' },
  { id: 6, title: '피임' },
  { id: 7, title: '연애' },
  { id: 8, title: '성병/검사' },
  { id: 9, title: '외모' },
  { id: 10, title: '생리' },
  { id: 11, title: '신체 변화' },
  { id: 12, title: '젠더' },
  { id: 13, title: '자위/욕구' },
  { id: 14, title: '임신/출산' },
  { id: 15, title: '온라인/디지털' },
];

const pickKeywords = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.keywords)) return payload.keywords;
  if (Array.isArray(payload?.data?.keywords)) return payload.data.keywords;
  return [];
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BUBBLE_SIZES = [250, 230, 210, 180, 160, 120];
const getBubbleSize = (index, total) => {
  const seed = (index + 3) * 17 + total * 11;
  const base = BUBBLE_SIZES[seed % BUBBLE_SIZES.length];
  const variance = (seed % 10) - 4; // -4 ~ +4
  return Math.max(120, base + variance * 5);
};

const getBubbleOffset = (index, size) => {
  const seed = (index + 5) * 31;
  const horizontalJitter = ((seed % 2) - 4) * 10; // -40 ~ +40
  const overlapRatio = 0.6 + ((seed % 7) - 3) * 0.02; // 0.34 ~ 0.82

  const isLeft = index % 2 === 0;
  const topOffset = size * overlapRatio;
  const baseHorizontal = size * 0.24;

  return {
    translateY: topOffset,
    horizontal: baseHorizontal + horizontalJitter,
    isLeft,
  };
};

export default function KeywordScenarioScreen() {
  const [keywords, setKeywords] = useState(FALLBACK);

  useEffect(() => {
    (async () => {
      try {
        const res = await quizApi.getKeywords();
        const received = pickKeywords(res);
        if (Array.isArray(received) && received.length) {
          setKeywords(received);
        }
      } catch {
        // 무시하고 폴백 데이터를 사용합니다.
      }
    })();
  }, []);

  const bubbles = useMemo(() => {
    const list = keywords.length ? keywords : FALLBACK;
    let currentTop = -SCREEN_HEIGHT * -0.01;

    return list.map((k, i) => {
      const scenarioId = Number(
          typeof k === 'object' && k
              ? k.id ?? k.scenarioId ?? FALLBACK[i % FALLBACK.length].id ?? i + 1
              : i + 1,
      );
      const label = typeof k === 'string' ? k : k?.title ?? k?.label ?? `키워드 ${i + 1}`;
      const size = getBubbleSize(i, list.length);
      const offset = getBubbleOffset(i, size);
      const top = currentTop;
      currentTop += offset.translateY;

      return {
        scenarioId,
        label,
        color: PALETTE[i % PALETTE.length],
        size,
        top,
        isLeft: offset.isLeft,
        horizontal: offset.horizontal,
      };
    });
  }, [keywords]);

  const layoutHeight = useMemo(() => {
    if (!bubbles.length) return SCREEN_HEIGHT;
    const maxBottom = bubbles.reduce((max, b) => Math.max(max, b.top + b.size), 0);
    return Math.max(SCREEN_HEIGHT * 0.9, maxBottom + 40);
  }, [bubbles]);

  const onPressKeyword = (bubble) =>
      router.push({
        pathname: '/scenario',
        params: { mode: 'KEYWORD', scenarioId: bubble.scenarioId, scenarioTitle: bubble.label },
      });

  return (
      <SafeAreaView style={S.safe}>
        <ScrollView contentContainerStyle={[S.scroll, { minHeight: layoutHeight + 60 }]}>
          <View style={[S.stack, { minHeight: layoutHeight }]}>
            {bubbles.map((b) => (
                <TouchableOpacity
                    key={`${b.scenarioId}-${b.label}`}
                    activeOpacity={0.88}
                    onPress={() => onPressKeyword(b)}
                    style={[
                      S.bubble,
                      {
                        width: b.size,
                        height: b.size,
                        borderRadius: b.size / 2,
                        backgroundColor: b.color,
                        top: b.top,
                        left: b.isLeft ? -b.horizontal : undefined,
                        right: !b.isLeft ? -b.horizontal : undefined,
                      },
                    ]}
                >
                  <Text style={S.text} numberOfLines={3}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { paddingHorizontal: 12, paddingBottom: 32 },
  stack: { position: 'relative', paddingVertical: 24 },
  bubble: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 4,
    paddingHorizontal: 18,
  },
  text: {
    fontFamily: 'PretendardBold',
    fontSize: 17,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
});