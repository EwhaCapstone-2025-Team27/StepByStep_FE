// app/profile.js
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ProfileEditScreen() {
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('female'); 
  const [birthYear, setBirthYear] = useState('');

  // 비밀번호(선택)
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 내 정보 불러오기(선택)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/users/me`);
        if (!res.ok) return;
        const data = await res.json();
        setNickname(data.nickname ?? '');
        setGender(data.gender ?? 'other');
        setBirthYear(data.birthYear ? String(data.birthYear) : '');
      } catch {}
    })();
  }, []);

  const validateProfile = () => {
    if (!nickname.trim()) {
      Alert.alert('입력 오류', '닉네임을 입력하세요.');
      return false;
    }
    const by = Number(birthYear);
    if (!by || by < 1900 || by > new Date().getFullYear()) {
      Alert.alert('입력 오류', '태어난 연도를 정확히 입력하세요.');
      return false;
    }
    return true;
  };

  const hasPwChange = () => currentPw || newPw || newPw2;

  const validatePassword = () => {
    if (!currentPw || !newPw || !newPw2) {
      Alert.alert('입력 오류', '비밀번호 변경을 원하시면 3칸을 모두 입력하세요.');
      return false;
    }
    if (newPw.length < 8) {
      Alert.alert('입력 오류', '새 비밀번호는 8자 이상이어야 합니다.');
      return false;
    }
    if (newPw !== newPw2) {
      Alert.alert('입력 오류', '새 비밀번호와 확인이 일치하지 않습니다.');
      return false;
    }
    return true;
  };

  const onSaveAll = async () => {
    if (!validateProfile()) return;
    if (hasPwChange() && !validatePassword()) return;

    setLoading(true);
    try {
      // 1) 프로필 저장
      const res1 = await fetch(`${process.env.EXPO_PUBLIC_API}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          gender,
          birthYear: Number(birthYear),
        }),
      });
      if (!res1.ok) {
        const e = await res1.json().catch(() => ({}));
        throw new Error(e.message || '프로필 저장에 실패했습니다.');
      }

      // 2) 비밀번호 변경(선택)
      if (hasPwChange()) {
        const res2 = await fetch(`${process.env.EXPO_PUBLIC_API}/api/auth/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
        });
        if (!res2.ok) {
          const e = await res2.json().catch(() => ({}));
          throw new Error(e.message || '비밀번호 변경에 실패했습니다.');
        }
      }

      Alert.alert('완료', hasPwChange() ? '프로필/비밀번호가 저장되었습니다.' : '프로필이 저장되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const onConfirmDelete = () => {
    Alert.alert(
      '회원 탈퇴',
      '정말 탈퇴하시겠어요? 모든 데이터가 삭제될 수 있습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴', style: 'destructive', onPress: onDeleteAccount },
      ]
    );
  };

  const onDeleteAccount = async () => {
    setDeleting(true);
    try {
      // 실제 백엔드에 맞춰 엔드포인트 조정
      const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/users/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || '회원 탈퇴에 실패했습니다.');
      }

      Alert.alert('탈퇴 완료', '그동안 이용해 주셔서 감사합니다.', [
        {
          text: '확인',
          onPress: () => {
            // TODO: 토큰/세션을 저장했다면 여기서 정리(AsyncStorage/SecureStore 등)
            // 예) await AsyncStorage.removeItem('accessToken');
            router.replace('/login');
          },
        },
      ]);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={S.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={S.back}>‹</Text>
          </TouchableOpacity>
          <Text style={S.title}>개인정보 수정</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Body (스크롤) */}
        <ScrollView contentContainerStyle={S.body} keyboardShouldPersistTaps="handled">
          {/* 닉네임 */}
          <Text style={S.label}>닉네임</Text>
          <TextInput
            style={S.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="닉네임"
            maxLength={20}
          />

          {/* 성별 */}
          <Text style={S.label}>성별</Text>
          <View style={S.row}>
            <TouchableOpacity style={[S.seg, gender === 'male' && S.segOn]} onPress={() => setGender('male')}>
              <Text style={[S.segTxt, gender === 'male' && { color: '#fff' }]}>남</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.seg, gender === 'female' && S.segOn]} onPress={() => setGender('female')}>
              <Text style={[S.segTxt, gender === 'female' && { color: '#fff' }]}>여</Text>
            </TouchableOpacity>
          </View>

          {/* 태어난 연도 */}
          <Text style={S.label}>태어난 연도</Text>
          <TextInput
            style={S.input}
            placeholder="예: 2002"
            value={birthYear}
            onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={4}
          />

          {/* 비밀번호 변경(선택) — 같은 섹션 */}
          <Text style={[S.label, { marginTop: 8 }]}>비밀번호 변경 (선택)</Text>
          <TextInput
            style={S.input}
            placeholder="현재 비밀번호"
            value={currentPw}
            onChangeText={setCurrentPw}
            secureTextEntry
          />
          <TextInput
            style={S.input}
            placeholder="새 비밀번호 (8자 이상)"
            value={newPw}
            onChangeText={setNewPw}
            secureTextEntry
          />
          <TextInput
            style={S.input}
            placeholder="새 비밀번호 확인"
            value={newPw2}
            onChangeText={setNewPw2}
            secureTextEntry
          />
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer 고정: 저장 + 회원탈퇴 */}
        <View style={S.footer}>
          <TouchableOpacity style={[S.btn, S.primary]} onPress={onSaveAll} disabled={loading || deleting}>
            <Text style={S.btnText}>{loading ? '저장 중...' : '저장'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.btn, S.danger]}
            onPress={onConfirmDelete}
            disabled={loading || deleting}
            activeOpacity={0.85}
          >
            <Text style={S.dangerText}>{deleting ? '처리 중...' : '회원 탈퇴'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  back: { fontSize: 26, color: '#374151' },
  title: { fontSize: 18, fontFamily: 'PretendardBold' },

  body: { padding: 16, gap: 10 },

  label: { color: '#6b7280', fontSize: 13, marginBottom: 6 },

  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },

  row: { flexDirection: 'row', gap: 8 },

  seg: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segOn: { backgroundColor: '#111827', borderColor: '#111827' },
  segTxt: { color: '#111827' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
    gap: 8,
  },
  btn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#111827' },
  btnText: { color: '#fff', fontFamily: 'PretendardBold', fontSize: 16 },

  danger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  dangerText: {
    color: '#ef4444',
    fontFamily: 'PretendardBold',
    fontSize: 15,
  },
});