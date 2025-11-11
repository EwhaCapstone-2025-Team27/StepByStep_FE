// screens/SignUpScreen.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authApi } from '../lib/apiClient.js';
import {
    normalizeGenderForApi,
    sanitizeBirthYearInput,
    validateBirthYear,
    validateEmail,
    validateGender,
    validateNickname,
    validatePassword,
} from '../lib/validation.js';

export default function SignUpScreen() {
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [gender, setGender] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [nickOk, setNickOk] = useState(null);
    const [loading, setLoading] = useState(false);

    const checkNickname = async (value) => {
        const base = typeof value === 'string' ? value : nickname;
        const trimmed = base.trim();
        if (!trimmed) {
            setNickOk(null);
            return null;
        }

        if (validateNickname(trimmed) !== null) {
            // 형식이 올바르지 않으면 서버 호출 없이 상태만 초기화
            setNickOk(null);
            return null;
        }
        try {
            const data = await authApi.checkNickname(trimmed);
            const available = [data?.available, data?.isAvailable, data?.ok]
                .find((v) => typeof v === 'boolean');
            setNickOk(typeof available === 'boolean' ? available : null);
            return typeof available === 'boolean' ? available : null;
        } catch (err) {
            if (err?.status === 409) {
                setNickOk(false);
                return false;
            }
            setNickOk(null);
            return null;
        }
    };

    const onRegister = async () => {
        const trimmedNickname = nickname.trim();
        const nicknameError = validateNickname(trimmedNickname);
        if (nicknameError) return Alert.alert('회원가입', nicknameError);

        if (nickOk !== true) {
            const available = await checkNickname(trimmedNickname);
            if (available === false) {
                return Alert.alert('회원가입', '이미 사용 중인 닉네임입니다.');
            }
        }

        const emailError = validateEmail(email);
        if (emailError) return Alert.alert('회원가입', emailError);

        const passwordError = validatePassword(pw);
        if (passwordError) return Alert.alert('회원가입', passwordError);
        const passwordConfirmError = validatePassword(pw2, { label: '비밀번호 확인' });
        if (passwordConfirmError) return Alert.alert('회원가입', passwordConfirmError);
        if (pw !== pw2) return Alert.alert('회원가입', '비밀번호가 일치하지 않습니다.');

        const genderError = validateGender(gender);
        if (genderError) return Alert.alert('회원가입', genderError);

        const birthError = validateBirthYear(birthYear);
        if (birthError) return Alert.alert('회원가입', birthError);
        const sanitizedYear = sanitizeBirthYearInput(birthYear);
        const by = Number(sanitizedYear);

        try {
            setLoading(true);
            await authApi.register({
                email: email.trim(),
                password: pw,
                passwordConfirm: pw2,
                nickname: trimmedNickname,
                gender: normalizeGenderForApi(gender) ?? gender,
                birthYear: by,
            });
            Alert.alert('가입 완료', '환영합니다!', [{ text: '확인', onPress: () => router.replace('/login') }]);
        } catch (err) {
            Alert.alert('가입 실패', err?.message || '가입에 실패했습니다.');
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
                    placeholder="닉네임 (3~10자, 한글/영문/숫자)"
                    value={nickname}
                    onChangeText={(t) => { setNickname(t); setNickOk(null); }}
                    onBlur={() => checkNickname()}
                    maxLength={10}
                />
                {nickOk === false && <Text style={S.err}>이미 사용 중인 닉네임입니다.</Text>}
                {nickOk === true  && <Text style={S.ok}>사용 가능한 닉네임입니다.</Text>}

                <TextInput style={S.input} placeholder="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={S.input} placeholder="비밀번호 (8~20자)" value={pw} onChangeText={setPw} secureTextEntry maxLength={20} />
                <TextInput style={S.input} placeholder="비밀번호 확인" value={pw2} onChangeText={setPw2} secureTextEntry maxLength={20} />

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
                    placeholder="태어난 해 (예: 2010)"
                    value={birthYear}
                    onChangeText={(value) => setBirthYear(sanitizeBirthYearInput(value))}
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
    segTxtOn: { color:'#fff', fontFamily:'PretendardBold' },
    ghost: { backgroundColor:'#f3f4f6' },
    btnTextWhite: { color:'#fff', fontFamily:'PretendardBold' },
    btnTextDark: { color:'#111827', fontFamily:'PretendardBold' },
    err: { color:'#dc2626' }, ok: { color:'#16a34a' },
});