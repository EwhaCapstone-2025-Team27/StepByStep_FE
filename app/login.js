// app/login.js
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { authApi } from '../lib/apiClient.js';
import { useAuth } from '../lib/auth-context.js';
import { validateEmail, validatePassword } from '../lib/validation.js';

const isTruthyFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return false;
  }
  return Boolean(value);
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const authCtx = useAuth();
  const setTokens = authCtx?.setTokens ?? (async () => {});

  const onLogin = async () => {
    if (!authApi || typeof authApi.login !== 'function') {
      return Alert.alert('로그인 실패', 'API 클라이언트를 불러오지 못했습니다. (authApi)');
    }
    const emailError = validateEmail(email);
    if (emailError) return Alert.alert('로그인', emailError);

    const passwordError = validatePassword(pw);
    if (passwordError) return Alert.alert('로그인', passwordError);

    try {
      setLoading(true);

      // 서버 규약: POST /api/auth/login
      const res = await authApi.login({ email: email.trim(), password: pw });

      // 다양한 응답 키 대응
      const accessToken =
          res?.accessToken ?? res?.access_token ?? res?.token ?? res?.data?.accessToken ?? null;
      const refreshToken =
          res?.refreshToken ?? res?.refresh_token ?? res?.data?.refreshToken ?? null;

      const accessExpSec =
          res?.accessTokenExpiresIn ?? res?.access_expires_in ?? res?.expires_in;
      const refreshExpSec =
          res?.refreshTokenExpiresIn ?? res?.refresh_expires_in;

      const nickname =
          res?.nickname ?? res?.data?.nickname ?? res?.user?.nickname ?? res?.profile?.nickname ?? null;
      const userId =
          res?.userId ?? res?.data?.userId ?? res?.user?.id ?? res?.profile?.id ?? null;

      if (!accessToken) throw new Error('토큰 발급에 실패했습니다.');

      const user = {
        ...(res?.user || res?.profile || {}),
        ...(nickname ? { nickname } : {}),
        ...(userId ? { id: userId } : {}),
      };

      const accessTokenExpiresAt =
          typeof accessExpSec === 'number' ? Date.now() + accessExpSec * 1000 : undefined;
      const refreshTokenExpiresAt =
          typeof refreshExpSec === 'number' ? Date.now() + refreshExpSec * 1000 : undefined;

      // 로컬 저장(다른 화면에서 바로 사용)
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken ?? ''],
        ...(nickname ? [['user_nickname', String(nickname)]] : []),
        ...(userId ? [['x_user_id', String(userId)]] : []),
      ]);

      // 컨텍스트 저장(있을 때만)
      await setTokens({
        accessToken,
        refreshToken,
        user,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      });

      const tempPwFlags = [
        res?.isTemporaryPassword,
        res?.temporaryPassword,
        res?.data?.isTemporaryPassword,
        res?.data?.temporaryPassword,
        res?.user?.isTemporaryPassword,
        res?.user?.temporaryPassword,
        res?.profile?.isTemporaryPassword,
        res?.profile?.temporaryPassword,
      ];

      const forceProfileFlags = [
        res?.requiresProfileUpdate,
        res?.data?.requiresProfileUpdate,
        res?.user?.requiresProfileUpdate,
        res?.profile?.requiresProfileUpdate,
      ];

      const mustChangePasswordFlags = [
        res?.mustChangePassword,
        res?.must_change_password,
        res?.forcePasswordChange,
        res?.force_password_change,
        res?.data?.mustChangePassword,
        res?.data?.must_change_password,
        res?.data?.forcePasswordChange,
        res?.data?.force_password_change,
        res?.user?.mustChangePassword,
        res?.user?.must_change_password,
        res?.user?.forcePasswordChange,
        res?.user?.force_password_change,
        res?.profile?.mustChangePassword,
        res?.profile?.must_change_password,
        res?.profile?.forcePasswordChange,
        res?.profile?.force_password_change,
      ];

      const shouldGoProfile = [...tempPwFlags, ...forceProfileFlags, ...mustChangePasswordFlags].some(
          (v) => isTruthyFlag(v)
      );

      if (shouldGoProfile) {
        router.replace('/changePW');
        setTimeout(() => {
          Alert.alert(
              '비밀번호 변경 필요',
              '임시 비밀번호로 로그인하셨어요. 비밀번호 변경 페이지로 이동합니다.'
          );
        }, 100);
        return;
      }

      router.replace('/home');
    } catch (err) {
      let message = err?.message || '로그인에 실패했습니다. 이메일과 비밀번호를 다시 확인하세요.';
      if (err?.status === 404) {
        message = '가입된 이메일을 찾을 수 없습니다.';
      } else if (err?.status === 401) {
        message = '비밀번호가 일치하지 않습니다.';
      } else if (err?.status === 403) {
        message = '탈퇴한 계정입니다. 고객센터로 문의해주세요.';
      }
      Alert.alert('로그인 실패', message);
    } finally {
      setLoading(false);
    }
  };

  return (
      <SafeAreaView style={S.safe}>
        <View style={S.wrap}>
          <View style={S.header}>
            <Image source={require('../image/img/bot.png')} style={S.logo} resizeMode="contain" />
            <Text style={S.title}>로그인</Text>
          </View>

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
          </View>

          <View style={S.links}>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={S.link}>회원가입</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/findEmail')}>
              <Text style={S.link}>이메일 찾기</Text>
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
  safe: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  wrap: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { alignItems: 'center', gap: 8 },
  logo: { width: 200, height: 200, marginBottom: -40 },
  title: { fontSize: 28, textAlign: 'center', fontWeight: '800' },
  form: { marginTop: 20, width: '100%', gap: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  btn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#111827' },
  btnTextWhite: { color: '#fff', fontWeight: '800' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 18 },
  link: { color: '#6b7280' },
});