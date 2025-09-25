// screens/FindIdScreen.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function FindIdScreen() {
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const onFind = async () => {
    if (!nickname.trim() || !birthYear) return Alert.alert('아이디 찾기', '닉네임을 입력하세요.');
    try {
      // TODO: 실제 API에 맞게 변경: GET /api/auth/find-id?nickname=&birthYear=
      const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/auth/find-id?nickname=${encodeURIComponent(nickname)}&birthYear=${birthYear}`);
      if (!res.ok) throw new Error('일치하는 정보가 없습니다.');
      const data = await res.json();
      Alert.alert('아이디 찾기', `가입 이메일: ${data.emailMasked || '***@***'}`, [
        { text: '로그인으로', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      Alert.alert('아이디 찾기 실패', e.message);
    }
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.wrap}>
       <TouchableOpacity onPress={() => router.back()} style={{marginBottom:12}}>
         <Text style={{ fontSize:16, color:'#6b7280' }}>‹ 로그인으로</Text>
       </TouchableOpacity>
        <Text style={S.title}>아이디 찾기</Text>
        <TextInput style={S.input} placeholder="닉네임" value={nickname} onChangeText={setNickname} />
        <TouchableOpacity style={[S.btn, S.primary]} onPress={onFind}>
          <Text style={S.btnTextWhite}>찾기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex:1, backgroundColor:'#fff' },
  wrap: { flex:1, padding:24, gap:12 },
  title: { fontFamily:'PretendardBold', fontSize:22, marginBottom:6 },
  input: { borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, padding:12, fontSize:15 },
  btn: { height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
  primary: { backgroundColor:'#111827' },
  btnTextWhite: { color:'#fff', fontFamily:'PretendardBold' },
});