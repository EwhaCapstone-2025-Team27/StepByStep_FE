// app/home.js
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* 배경 그라데이션: 화면 전체 덮기 */}
      <LinearGradient
        colors={['#9461cbff', '#cba4f8ff','#fafafaff']} // 원하는 색 조합 (연보라 → 진보라)
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        {/* 상단 우측: 개인정보 수정 */}
        <View style={styles.headerRow}>
          <View />
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            style={styles.profileSmallBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.profileSmallText}>개인정보 수정</Text>
          </TouchableOpacity>
        </View>

        {/* 콘텐츠 */}
        <View style={styles.container}>
          <Image
            source={require("../image/img/scsc1.png")}
            style={{ width: 300, height: 300, marginBottom: -80 }}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>안녕 나는 토리야! 만나서 반가워</Text>
          <Text style={styles.title}>성큼성큼</Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.primary]}
              onPress={() => router.push('/chat')}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: '#ffffff' }]}>챗봇과 상담하기</Text>
              <Text style={styles.btnSub}>RAG 기반 Q&A</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.secondary]}
              onPress={() => router.push('/scenarioSelect')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>시나리오</Text>
              <Text style={styles.btnSub}>상황형 퀴즈로 학습</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.secondary]}
              onPress={() => router.push('/board')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>게시판</Text>
              <Text style={styles.btnSub}>익명으로 소통하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  profileSmallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileSmallText: { fontSize: 12, color: '#374151' },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'PretendardBold',
  },
  subtitle: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'PretendardMedium',
  },
  buttons: { marginTop: 24, width: '100%', gap: 14 },
  btn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#e5e7eb' },
  btnText: { fontSize: 18, color: '#111827', fontFamily: 'PretendardBold' },
  btnSub: { marginTop: 4, fontSize: 12, color: '#6b7280', fontFamily: 'PretendardMedium' },
});