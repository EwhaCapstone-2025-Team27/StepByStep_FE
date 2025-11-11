// screens/ResetPasswordScreen.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authApi } from '../lib/apiClient.js';

export default function ResetPasswordScreen() {
    const [email, setEmail] = useState('');

    const onSend = async () => {
        if (!email.trim()) return Alert.alert('비밀번호 재설정', '이메일을 입력하세요.');
        try {
            await authApi.requestTemporaryPassword({ email: email.trim() });
            Alert.alert('임시 비밀번호 발송', '해당 메일로 임시 비밀번호가 전송되었습니다. 확인해주세요.', [
                { text: '로그인으로', onPress: () => router.replace('/login') },
            ]);
        } catch (e) {
            Alert.alert('오류', e.message);
        }
    };

    return (
        <SafeAreaView style={S.safe}>
            <View style={S.wrap}>
                <TouchableOpacity onPress={() => router.back()} style={{marginBottom:12}}>
                    <Text style={{ fontSize:16, color:'#6b7280' }}>‹ 로그인으로</Text>
                </TouchableOpacity>
                <Text style={S.title}>비밀번호 찾기</Text>
                <TextInput style={S.input} placeholder="가입 이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <TouchableOpacity style={[S.btn, S.primary]} onPress={onSend}>
                    <Text style={S.btnTextWhite}>임시 비밀번호 발급 받기</Text>
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