// screens/ScenarioSelectScreen.js
import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ScenarioSelectScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header (ChatScreen과 동일 패턴) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>시나리오 선택</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title}>시나리오 문제 풀기</Text>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/keywordScenario')}
          activeOpacity={0.9}
        >
          <Text style={styles.btnText}>키워드별 시나리오 문제 풀기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/scenario')}
          activeOpacity={0.9}
        >
          <Text style={styles.btnText}>랜덤 시나리오 문제 풀기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/** ==== UI 토큰 (ChatScreen과 톤 맞춤) ==== */
const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  /** Header - ChatScreen과 동일 패턴 */
  header: {
    height: 56,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: { color: TEXT_MAIN, fontSize: 17, fontWeight: '700' },
  headerIcon: { color: TEXT_SUB, fontSize: 22 },

  /** Body */
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  title: { fontSize: 24, fontFamily: 'PretendardBold', marginBottom: 40, color: TEXT_MAIN },

  /** Buttons */
  btn: {
    width: '80%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#a78bfa',
    marginVertical: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 18, fontFamily: 'PretendardMedium' },
});