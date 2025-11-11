// app/changePW.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { authApi } from '../lib/apiClient';
import { useAuth } from '../lib/auth-context';
import { validatePassword } from '../lib/validation.js';

export default function ChangePasswordScreen() {
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const auth = useAuth();
    const logout = auth?.logout ?? (async () => {});

    const validate = () => {
        const trimmedNew = newPw.trim();
        const trimmedConfirm = confirmPw.trim();
        const newError = validatePassword(trimmedNew, { label: '새 비밀번호' });
        if (newError) {
            Alert.alert('입력 오류', newError);
            return false;
        }
        const confirmError = validatePassword(trimmedConfirm, { label: '새 비밀번호 확인' });
        if (confirmError) {
            Alert.alert('입력 오류', confirmError);
            return false;
        }
        if (trimmedNew !== trimmedConfirm) {
            Alert.alert('입력 오류', '새 비밀번호와 확인이 일치하지 않습니다.');
            return false;
        }
        return true;
    };

    const onSubmit = async () => {
        if (!validate()) return;

        setSubmitting(true);
        try {
            const trimmedNew = newPw.trim();
            const trimmedConfirm = confirmPw.trim();

            await authApi.changePassword({
                newPassword: trimmedNew,
                newPasswordConfirm: trimmedConfirm,
            });

            setNewPw('');
            setConfirmPw('');

            Alert.alert('비밀번호 변경 완료', '새 비밀번호로 다시 로그인해주세요.', [
                {
                    text: '확인',
                    onPress: async () => {
                        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
                        await logout().catch(() => {});
                        router.replace('/login');
                    },
                },
            ]);
        } catch (e) {
            Alert.alert('비밀번호 변경 실패', e?.message ?? '비밀번호 변경에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={S.safe}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={80}
            >
                <View style={S.wrap}>
                    <Text style={S.title}>비밀번호 변경</Text>
                    <Text style={S.subtitle}>
                        임시 비밀번호로 로그인했으므로 보안을 위해 새 비밀번호로 변경한 뒤 다시 로그인해주세요.
                    </Text>

                    <View style={S.form}>
                        <TextInput
                            style={S.input}
                            value={newPw}
                            onChangeText={setNewPw}
                            placeholder="새 비밀번호"
                            secureTextEntry
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={S.input}
                            value={confirmPw}
                            onChangeText={setConfirmPw}
                            placeholder="새 비밀번호 확인"
                            secureTextEntry
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity
                        style={[S.btn, submitting ? S.btnDisabled : S.btnPrimary]}
                        onPress={onSubmit}
                        disabled={submitting}
                    >
                        <Text style={S.btnText}>{submitting ? '변경 중...' : '비밀번호 변경'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const S = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },
    wrap: { flex: 1, padding: 24, gap: 18, justifyContent: 'center' },
    title: { fontSize: 24, fontFamily: 'PretendardBold', textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
    form: { gap: 12 },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        backgroundColor: '#fff',
    },
    btn: {
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: '#111827' },
    btnDisabled: { backgroundColor: '#4b5563' },
    btnText: { color: '#fff', fontFamily: 'PretendardBold', fontSize: 16 },
});