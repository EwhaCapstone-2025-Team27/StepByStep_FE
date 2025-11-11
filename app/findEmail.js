// screens/FindIdScreen.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authApi } from '../lib/apiClient.js';
import {
    sanitizeBirthYearInput,
    validateBirthYear,
    validateGender,
    validateNickname,
} from '../lib/validation.js';

export default function FindIdScreen() {
    const [nickname, setNickname] = useState('');
    const [gender, setGender] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const onFind = async () => {
        const nicknameError = validateNickname(nickname);
        if (nicknameError) return Alert.alert('아이디 찾기', nicknameError);

        const genderError = validateGender(gender);
        if (genderError) return Alert.alert('아이디 찾기', genderError);

        const birthError = validateBirthYear(birthYear);
        if (birthError) return Alert.alert('아이디 찾기', birthError);
        const by = Number(sanitizeBirthYearInput(birthYear));
        try {
            const data = await authApi.findEmail({
                nickname: nickname.trim(),
                gender,
                birthYear: by,
            });

            const email = data?.email ?? data?.emailMasked ?? null;
            if (!email) throw new Error('일치하는 정보가 없습니다.');

            Alert.alert('아이디 찾기 성공', `가입 이메일: ${email}`, [
                { text: '로그인으로', onPress: () => router.replace('/login') },
            ]);
        } catch (e) {
            Alert.alert('아이디 찾기 실패', e?.message || '일치하는 정보를 찾지 못했습니다.');
        }
    };

    return (
        <SafeAreaView style={S.safe}>
            <View style={S.wrap}>
                <TouchableOpacity onPress={() => router.back()} style={{marginBottom:12}}>
                    <Text style={{ fontSize:16, color:'#6b7280' }}>‹ 로그인으로</Text>
                </TouchableOpacity>
                <Text style={S.title}>아이디 찾기</Text>
                <TextInput
                    style={S.input}
                    placeholder="닉네임 (3~10자, 한글/영문/숫자)"
                    value={nickname}
                    onChangeText={setNickname}
                    maxLength={10}
                />
                <View style={S.row}>
                    <TouchableOpacity
                        style={[S.seg, gender === 'M' && S.segOn]}
                        onPress={() => setGender('M')}
                    >
                        <Text style={[S.segTxt, gender === 'M' && S.segTxtOn]}>남</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[S.seg, gender === 'F' && S.segOn]}
                        onPress={() => setGender('F')}
                    >
                        <Text style={[S.segTxt, gender === 'F' && S.segTxtOn]}>여</Text>
                    </TouchableOpacity>
                </View>
                <TextInput
                    style={S.input}
                    placeholder="출생년도 (예: 2010)"
                    value={birthYear}
                    onChangeText={(value) => setBirthYear(sanitizeBirthYearInput(value))}
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
    input: { borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, padding:12, fontSize:15 },
    btn: { height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
    primary: { backgroundColor:'#111827' },
    btnTextWhite: { color:'#fff', fontFamily:'PretendardBold' },
    row: { flexDirection:'row', gap:8 },
    seg: { flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, paddingVertical:10, alignItems:'center' },
    segOn: { backgroundColor:'#111827' },
    segTxt: { color:'#111827' },
    segTxtOn: { color:'#fff', fontFamily:'PretendardBold' },
});