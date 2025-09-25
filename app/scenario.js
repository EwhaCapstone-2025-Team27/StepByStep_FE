import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const QUESTIONS = [
  {
    id: 1,
    title: '상황 1: 데이트 중 경계선 설정',
    prompt:
      '상대가 스킨십을 시도했지만 나는 아직 준비되지 않았어요. 어떻게 말하는 것이 좋을까요?',
    options: [
      '그냥 침묵한다.',
      '상대가 기분 나쁠까 봐 억지로 따라간다.',
      '"난 아직 준비되지 않았어. 천천히 가고 싶어."라고 분명하게 말한다.',
      '대화를 피하기 위해 자리를 떠난다.',
    ],
    correctIndex: 2,
    explain:
      '동의(Consent)는 명확하고 자발적이며 언제든 취소할 수 있어요. 감정 상하지 않게 “천천히 가고 싶다”고 경계를 분명히 하는 것이 건강한 방식입니다.',
  },
  {
    id: 2,
    title: '상황 2: 온라인에서 사진 요청',
    prompt:
      '온라인 친구가 개인 사진을 보내달라고 요구해요. 어떻게 해야 할까요?',
    options: [
      '나만 보낼 거니까 괜찮다.',
      '원치 않으면 단호히 거절하고, 계속 요구하면 차단한다.',
      '개인정보를 일부만 가린 사진을 보낸다.',
      '상대가 먼저 보냈으니 나도 보낸다.',
    ],
    correctIndex: 1,
    explain:
      '사적인 사진 공유는 유출/악용 위험이 큽니다. 거절 권리는 언제나 있으며, 지속되면 차단/신고가 바람직합니다.',
  },
];

export default function ScenarioScreen() {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score, setScore] = useState(0);
  const { keyword } = useLocalSearchParams();

  const q = useMemo(() => QUESTIONS[step], [step]);

  const choose = (idx) => {
    setChosen(idx);
    if (idx === q.correctIndex) setScore((s) => s + 1);
  };

  const next = () => {
    setChosen(null);
    if (step + 1 < QUESTIONS.length) setStep((s) => s + 1);
  };

  const done = step === QUESTIONS.length - 1 && chosen !== null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더: 뒤로가기(홈) + 제목 + 진행 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/home')} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={{alignItems:'center', flex:1}}>
          <Text style={styles.title}>상황형 학습</Text>
          <Text style={styles.progress}>
            {step + 1} / {QUESTIONS.length} · 점수 {score}
          </Text>
        </View>
        <View style={{width:20}} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{q.title}</Text>
        <Text style={styles.prompt}>{q.prompt}</Text>

        <View style={{ gap: 10, marginTop: 12 }}>
          {q.options.map((opt, idx) => {
            const selected = chosen === idx;
            const correct = chosen !== null && idx === q.correctIndex;
            const wrong = selected && idx !== q.correctIndex;

            return (
              <TouchableOpacity
                key={idx}
                disabled={chosen !== null}
                onPress={() => choose(idx)}
                style={[
                  styles.opt,
                  selected && styles.optSelected,
                  correct && styles.optCorrect,
                  wrong && styles.optWrong,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optText,
                    selected && styles.optTextSelected,
                    (correct || wrong) && styles.optTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {chosen !== null && (
          <View style={styles.explain}>
            <Text style={styles.explainText}>{q.explain}</Text>
          </View>
        )}

        {chosen !== null && !done && (
          <TouchableOpacity style={styles.nextBtn} onPress={next}>
            <Text style={styles.nextText}>다음</Text>
          </TouchableOpacity>
        )}

        {done && (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>완료!</Text>
            <Text style={styles.resultText}>
              최종 점수 {score} / {QUESTIONS.length}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backIcon: { fontSize: 22, color: '#111827' },
  title: { fontSize: 20, fontFamily: 'PretendardBold' },
  
  progress: { marginTop: 4, color: '#6b7280' },
  card: { flex: 1, padding: 20, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  prompt: { fontSize: 15, color: '#111827', lineHeight: 22 },
  opt: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  optSelected: { borderColor: '#111827' },
  optCorrect: { backgroundColor: '#DCFCE7', borderColor: '#16a34a' },
  optWrong: { backgroundColor: '#FEE2E2', borderColor: '#ef4444' },
  optText: { color: '#111827' },
  optTextSelected: { fontWeight: '700' },
  explain: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  explainText: { color: '#374151' },
  nextBtn: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  nextText: { color: '#fff', fontWeight: '700' },
  result: { marginTop: 16, alignItems: 'center', gap: 6 },
  resultTitle: { fontSize: 18, fontWeight: '800' },
  resultText: { color: '#6b7280' },
});