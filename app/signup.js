// screens/SignUpScreen.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignUpScreen() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [gender, setGender] = useState('other');
  const [birthYear, setBirthYear] = useState('');
  const [nickOk, setNickOk] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkNickname = async () => {
    if (!nickname.trim()) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
      const data = await res.json();
      setNickOk(Boolean(data.ok));
    } catch {
      setNickOk(null);
    }
  };

  const onRegister = async () => {
    if (!nickname.trim()) return Alert.alert('회원가입', '닉네임을 입력하세요.');
    if (nickOk === false) return Alert.alert('회원가입', '이미 사용 중인 닉네임입니다.');
    if (!email.trim()) return Alert.alert('회원가입', '이메일을 입력하세요.');
    if (pw.length < 8) return Alert.alert('회원가입', '비밀번호는 8자 이상이어야 합니다.');
    if (pw !== pw2) return Alert.alert('회원가입', '비밀번호가 일치하지 않습니다.');
    const by = Number(birthYear);
    if (!by || by < 1900) return Alert.alert('회원가입', '태어난 해를 정확히 입력하세요.');

    try {
      setLoading(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw, passwordConfirm: pw2, nickname, gender, birthYear: by }),
      });
      if (res.status !== 201) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || '가입에 실패했습니다.');
      }
      Alert.alert('가입 완료', '환영합니다!', [{ text: '확인', onPress: () => router.replace('/login') }]);
    } catch (err) {
      Alert.alert('가입 실패', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.wrap}>
       <TouchableOpacity onPress={() => router.back()} style={{marginBottom:12}}>
         <Text style={{ fontSize:16, color:'#6b7280' }}>‹ 로그인으로</Text>
       </TouchableOpacity>
        <Text style={S.title}>회원가입</Text>

        <TextInput
          style={S.input}
          placeholder="닉네임 (중복 금지)"
          value={nickname}
          onChangeText={(t) => { setNickname(t); setNickOk(null); }}
          onBlur={checkNickname}
        />
        {nickOk === false && <Text style={S.err}>이미 사용 중인 닉네임입니다.</Text>}
        {nickOk === true  && <Text style={S.ok}>사용 가능한 닉네임입니다.</Text>}

        <TextInput style={S.input} placeholder="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={S.input} placeholder="비밀번호 (8자 이상)" value={pw} onChangeText={setPw} secureTextEntry />
        <TextInput style={S.input} placeholder="비밀번호 확인" value={pw2} onChangeText={setPw2} secureTextEntry />

        <View style={S.row}>
          <TouchableOpacity style={[S.seg, gender==='male'&&S.segOn]} onPress={()=>setGender('male')}>
            <Text style={S.segTxt}>남</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.seg, gender==='female'&&S.segOn]} onPress={()=>setGender('female')}>
            <Text style={S.segTxt}>여</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={S.input}
          placeholder="태어난 해 (예: 2002)"
          value={birthYear}
          onChangeText={setBirthYear}
          keyboardType="number-pad"
          maxLength={4}
        />

        <TouchableOpacity style={[S.btn, S.primary]} onPress={onRegister} disabled={loading}>
          <Text style={S.btnTextWhite}>{loading ? '가입 중...' : '가입하기'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[S.btn, S.ghost]} onPress={() => router.back()}>
          <Text style={S.btnTextDark}>취소</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  wrap: { flex: 1, padding: 24, gap: 10 },
  title: { fontFamily: 'PretendardBold', fontSize: 22, marginBottom: 6 },
  input: { borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, padding:12, fontSize:15 },
  row: { flexDirection:'row', gap:8 },
  seg: { flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, paddingVertical:10, alignItems:'center' },
  segOn: { backgroundColor:'#111827' },
  segTxt: { color:'#111827' },
  btn: { height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
  primary: { backgroundColor:'#111827' },
  ghost: { backgroundColor:'#f3f4f6' },
  btnTextWhite: { color:'#fff', fontFamily:'PretendardBold' },
  btnTextDark: { color:'#111827', fontFamily:'PretendardBold' },
  err: { color:'#dc2626' }, ok: { color:'#16a34a' },
});