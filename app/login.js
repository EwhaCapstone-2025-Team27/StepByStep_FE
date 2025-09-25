// app/login.js  (또는 screens/LoginScreen.js)
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !pw) return Alert.alert('로그인', '이메일과 비밀번호를 입력하세요.');
    try {
      setLoading(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || '로그인에 실패했습니다.');
      }
      // const { accessToken, refreshToken } = await res.json();
      // TODO: 토큰 저장 (SecureStore 등), 사용자 정보 로드
      router.replace('/home');
    } catch (err) {
      Alert.alert('로그인 실패', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.wrap}>
        {/* 헤더: 캐릭터 + 제목 */}
        <View style={S.header}>
          <Image
            source={require('../image/img/scsc1.png')}
            style={S.logo}
            resizeMode="contain"
          />
          <Text style={S.title}>로그인</Text>
        </View>

        {/* 폼 */}
        <View style={S.form}>
          <TextInput
            style={S.input}
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={S.input}
            value={pw}
            onChangeText={setPw}
            placeholder="비밀번호"
            secureTextEntry
          />

          <TouchableOpacity style={[S.btn, S.primary]} onPress={onLogin} disabled={loading}>
            <Text style={S.btnTextWhite}>{loading ? '로그인 중...' : '로그인'}</Text>
          </TouchableOpacity>

          {/* 개발/Test용 스킵 버튼 */}
          <TouchableOpacity style={[S.btn, S.ghost]} onPress={() => router.replace('/home')}>
            <Text style={S.btnTextDark}>로그인 건너뛰기 (테스트용)</Text>
          </TouchableOpacity>
        </View>

        {/* 하단 링크 */}
        <View style={S.links}>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={S.link}>회원가입</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/findEmail')}>
            <Text style={S.link}>아이디 찾기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/FindPw')}>
            <Text style={S.link}>비밀번호 찾기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff', paddingTop:20, },
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',  // 중앙 정렬
    gap: 16,                  
  },
  header: { alignItems: 'center', gap: 8 }, 
  logo: { width: 200, height: 200, marginBottom: -40 }, 
  title: { fontFamily: 'PretendardBold', fontSize: 28, textAlign: 'center' },
  subtitle: {
    fontFamily: 'PretendardMedium',
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: { marginTop: 20, width: '100%', gap: 12 },  // 폼도 여백 균형 맞춤
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  btn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#111827' },
  ghost: { backgroundColor: '#f3f4f6' },
  btnTextWhite: { color: '#fff', fontFamily: 'PretendardBold' },
  btnTextDark: { color: '#111827', fontFamily: 'PretendardBold' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 18 },
  link: { color: '#6b7280' },
});