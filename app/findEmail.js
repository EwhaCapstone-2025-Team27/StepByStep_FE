// screens/FindIdScreen.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authApi } from '../lib/apiClient';

export default function FindIdScreen() {
    const [nickname, setNickname] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [gender, setGender] = useState('');

    const onFind = async () => {
        if (!nickname.trim() || !gender || birthYear.length !== 4) {
            return Alert.alert('아이디 찾기', '닉네임, 성별, 태어난 해를 모두 입력하세요.');
        }
        try {
            const data = await authApi.findId({ nickname: nickname.trim(), gender, birthYear });
            const masked =
                data?.emailMasked ??
                data?.email_masked ??
                data?.email ??
                data?.username ??
                '***@***';
            Alert.alert('아이디 찾기', `가입 이메일: ${masked}`, [
                { text: '로그인으로', onPress: () => router.replace('/login') },
            ]);
        } catch (e) {
            const message = e?.message || '일치하는 회원 정보를 찾을 수 없습니다.';
            Alert.alert('아이디 찾기 실패', message);
        }
    };

    return (
        <SafeAreaView style={S.safe}>
            <View style={S.wrap}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, color: '#6b7280' }}>‹ 로그인으로</Text>
                </TouchableOpacity>
                <Text style={S.title}>아이디 찾기</Text>
                <Text style={S.label}>닉네임</Text>
                <TextInput style={S.input} placeholder="닉네임" value={nickname} onChangeText={setNickname} />
                <Text style={S.label}>성별</Text>
                <View style={S.row}>
                    <TouchableOpacity
                        style={[S.seg, gender === 'male' && S.segOn]}
                        onPress={() => setGender('male')}
                    >
                        <Text style={[S.segTxt, gender === 'male' && { color: '#fff' }]}>남</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[S.seg, gender === 'female' && S.segOn]}
                        onPress={() => setGender('female')}
                    >
                        <Text style={[S.segTxt, gender === 'female' && { color: '#fff' }]}>여</Text>
                    </TouchableOpacity>
                </View>
                <Text style={S.label}>태어난 해</Text>
                <TextInput
                    style={S.input}
                    placeholder="태어난 해 (예: 2002)"
                    value={birthYear}
                    onChangeText={(text) => setBirthYear(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={4}
                />
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
    label: { fontSize:14, fontFamily:'PretendardSemiBold', color:'#4b5563', marginTop:4, marginBottom:4 },
    row: { flexDirection:'row', gap:8 },
    seg: {
        flex:1,
        borderWidth:1,
        borderColor:'#e5e7eb',
        borderRadius:12,
        paddingVertical:12,
        alignItems:'center',
    },
    segOn: { backgroundColor:'#111827', borderColor:'#111827' },
    segTxt: { fontSize:15, fontFamily:'PretendardSemiBold', color:'#111827' },
    input: { borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, padding:12, fontSize:15 },
    btn: { height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
    primary: { backgroundColor:'#111827' },
    btnTextWhite: { color:'#fff', fontFamily:'PretendardBold' },
});