// app/scenario.js
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { quizApi } from '../lib/apiClient';

const mapOption = (opt, idx) => ({
  optionId: opt?.optionId ?? opt?.id ?? idx,
  label: opt?.label ?? ['A', 'B', 'C', 'D'][idx] ?? `${idx + 1}`,
  text: opt?.text ?? opt?.option ?? '',
});

const mapQuestion = (q, idx) => ({
  index: q?.index ?? idx + 1,
  questionId: q?.questionId ?? q?.id ?? idx,
  stem: q?.stem ?? q?.prompt ?? q?.question ?? '',
  options: Array.isArray(q?.options) ? q.options.map(mapOption) : [],
});

export default function ScenarioScreen() {
  const { mode: rawMode, scenarioId, scenarioTitle, questionCount } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState({ id: null, scenario: null, questionCount: 0 });
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [scoreTotal, setScoreTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState(null);

  const normalizedMode = (rawMode || 'RANDOM').toString().toUpperCase() === 'KEYWORD' ? 'KEYWORD' : 'RANDOM';
  const parsedScenarioId = scenarioId != null ? Number(scenarioId) : undefined;
  const parsedQuestionCount = questionCount != null ? Number(questionCount) : 2;

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setAnswers({});
      setCurrentIndex(0);
      setScoreTotal(0);
      setFinished(false);

      try {
        const res = await quizApi.createAttempt({
          mode: normalizedMode,
          scenarioId: parsedScenarioId,
          questionCount: Number.isFinite(parsedQuestionCount) ? parsedQuestionCount : 2,
        });

        const mappedQuestions = Array.isArray(res?.questions)
            ? res.questions.map(mapQuestion)
            : [];

        if (!mappedQuestions.length) throw new Error('문항이 없습니다.');

        setAttempt({
          id: res?.attemptId ?? null,
          scenario: res?.scenario ?? null,
          questionCount: res?.questionCount ?? mappedQuestions.length,
        });
        setQuestions(mappedQuestions);
      } catch (e) {
        console.log('[SCENARIO][ATTEMPT FAIL]', e?.message);
        const msg = e?.message || '문제를 불러오지 못했어요.';
        setError(msg);
        Alert.alert('알림', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [normalizedMode, parsedScenarioId, parsedQuestionCount]);

  const q = useMemo(() => questions[currentIndex], [questions, currentIndex]);
  const answer = q ? answers[q.questionId] : null;
  const correctOption = q?.options?.find((opt) => opt.optionId === answer?.correctOptionId);

  const choose = async (optionId) => {
    if (!q || !attempt.id || answer) return;
    try {
      const res = await quizApi.submitResponse({ attemptId: attempt.id, questionId: q.questionId, optionId });

      setAnswers((prev) => ({
        ...prev,
        [q.questionId]: {
          optionId,
          correct: !!res?.correct,
          correctOptionId: res?.correctOptionId,
          explanation: res?.explanation || '',
          totalScore: res?.totalScore,
          finished: !!res?.finished,
        },
      }));
      if (res?.totalScore != null) setScoreTotal(res.totalScore);
      setFinished(!!res?.finished);
    } catch (e) {
      const msg = e?.message || '답안을 제출하지 못했어요.';
      Alert.alert('알림', msg);
    }
  };

  const next = () => {
    if (currentIndex + 1 < questions.length) setCurrentIndex((s) => s + 1);
  };

  if (loading) {
    return (
        <SafeAreaView style={styles.safe}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10 }}>문제를 불러오는 중…</Text>
          </View>
        </SafeAreaView>
    );
  }

  if (!q || error) {
    return (
        <SafeAreaView style={styles.safe}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}>
            <Text>{error || '문제를 불러오지 못했어요.'}</Text>
            <TouchableOpacity style={styles.nextBtn} onPress={() => router.replace('/scenario')}>
              <Text style={styles.nextText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
    );
  }

  const progressText = `${currentIndex + 1} / ${attempt.questionCount || questions.length}`;
  const headerTitle = attempt?.scenario?.title || scenarioTitle || '시나리오 퀴즈';

  return (
      <SafeAreaView style={styles.safe}>
        {/* 헤더: 뒤로가기(홈) + 제목 + 진행 */}
        <View style={styles.header}>
          <TouchableOpacity
              onPress={() => router.replace('/home')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={styles.title}>상황형 학습 · {headerTitle}</Text>
            <Text style={styles.progress}>
              남은 문항 {progressText}
            </Text>
          </View>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>문항 {q.index}</Text>
          <Text style={styles.prompt}>{q.stem}</Text>

          <View style={{ gap: 10, marginTop: 12 }}>
            {q.options.map((opt, idx) => {
              const selected = answer?.optionId === opt.optionId;
              const correct = answer && opt.optionId === answer.correctOptionId;
              const wrong = selected && answer?.correct === false;

              return (
                  <TouchableOpacity
                      key={opt.optionId ?? idx}
                      disabled={!!answer}
                      onPress={() => choose(opt.optionId)}
                      style={[
                        styles.opt,
                        selected && styles.optSelected,
                        correct && styles.optCorrect,
                        wrong && styles.optWrong,
                      ]}
                      activeOpacity={0.8}
                  >
                    <Text style={[styles.optText, selected && styles.optTextSelected, (correct || wrong) && styles.optTextSelected]}>
                      {opt.label ? `${opt.label}. ` : ''}{opt.text}
                    </Text>
                  </TouchableOpacity>
              );
            })}
          </View>

          {answer && (
              <View style={styles.explain}>
                <Text style={styles.explainTitle}>{answer.correct ? '정답입니다!' : '아쉬워요.'}</Text>
                {correctOption?.text ? (
                    <Text style={styles.explainText}>
                      정답: {correctOption.label ? `${correctOption.label}. ` : ''}{correctOption.text}
                    </Text>
                ) : null}
                {answer.explanation ? (
                    <Text style={[styles.explainText, { marginTop: 6 }]}>{answer.explanation}</Text>
                ) : null}
              </View>
          )}

          {answer && !finished && currentIndex + 1 < questions.length && (
              <TouchableOpacity style={styles.nextBtn} onPress={next}>
                <Text style={styles.nextText}>다음</Text>
              </TouchableOpacity>
          )}

          {finished && (
              <View style={styles.result}>
                <Text style={styles.resultTitle}>결과</Text>
                <Text style={styles.resultText}>
                  맞은 개수 {scoreTotal} / {attempt.questionCount || questions.length}
                </Text>
                <View style={styles.buttons}>
                  <TouchableOpacity
                      style={[styles.btn, styles.primary]}
                      onPress={() => router.replace('/home')}
                      activeOpacity={0.85}
                  >
                    <Text style={[styles.btnText, styles.primaryText]}>홈화면으로 돌아가기</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                      style={[styles.btn, styles.secondary]}
                      onPress={() => router.replace('/scenarioSelect')}
                      activeOpacity={0.85}
                  >
                    <Text style={[styles.btnText, styles.secondaryText]}>퀴즈 선택으로 돌아가기</Text>
                  </TouchableOpacity>
                </View>
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
    gap: 4,
  },
  explainTitle: { fontWeight: '700', color: '#111827' },
  explainText: { color: '#374151', lineHeight: 20 },
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
  buttons: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: '80%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  primary: {
    backgroundColor: '#C296F4',
    borderColor: '#B06EF0',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C296F4',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#C296F4',
  },
});