// screens/ChatScreen.js
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, Image, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: 'sys-1',
      role: 'assistant',
      text: '안녕! 나는 토리야 ✨\n궁금한 내용을 입력하거나 고민을 말해줘!',
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  const scrollToBottom = () =>
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  const probeHealth = async () => {
    try {
      await systemApi.health(); // GET /api/healthz
      return true;
    } catch {
      Alert.alert('서버 점검 중', '잠시 후 다시 시도해주세요.');
      return false;
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || loading) return;

    // 서버 상태 체크
    const ok = await probeHealth();
    if (!ok) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: content, ts: Date.now() };
    const botMsgId = `b-${Date.now() + 1}`;
    const botMsg = { id: botMsgId, role: 'assistant', text: '', ts: Date.now() + 1 };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    // 스트리밍 시작
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await aiApi.stream({
        query: content,
        topk: 8,
        friendStyle: true,
        signal: controller.signal,
        onMessage: (token) => {
          setMessages((prev) =>
              prev.map((m) => (m.id === botMsgId ? { ...m, text: (m.text || '') + token } : m))
          );
          scrollToBottom();
        },
        onDone: () => {
          setLoading(false);
          abortRef.current = null;
        },
      });
    } catch (e) {
      setLoading(false);
      abortRef.current = null;
      Alert.alert('응답 실패', e?.message || '서버 통신에 실패했습니다.');
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const renderItem = ({ item }) => {
    const mine = item.role === 'user';
    return (
      <View style={[styles.msgRow, mine ? styles.rowRight : styles.rowLeft]}>
        {!mine && (
          <Image
            source={require('../image/img/sc6.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
        )}
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          <View style={[styles.tailBase, mine ? styles.tailRight : styles.tailLeft]} />
          <Text style={[styles.msgText, mine ? styles.mineText : styles.theirsText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  const Hero = () => (
    <View style={styles.heroCard}>
      <Image source={require('../image/img/chat.png')} style={styles.heroImage} />
      <View style={{ flex: 1 }}>
        <Text style={styles.heroName}>토리</Text>
        <Text style={styles.heroDesc}>무엇이든 편하게 물어보세요!</Text>
      </View>
      {loading ? (
        <TouchableOpacity onPress={stopStreaming} style={styles.stopBtn}>
          <Text style={styles.stopText}>정지</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>챗봇 상담</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <View style={styles.heroWrap}>
          <Hero />
        </View>

        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        {/* Input Row */}
        <View style={styles.inputWrap}>
          <TouchableOpacity style={styles.plusBtn} activeOpacity={0.8}>
            <Text style={styles.plusText}>＋</Text>
          </TouchableOpacity>

          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="궁금한 점을 입력해 주세요."
              placeholderTextColor="#8a8f98"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && { opacity: 0.4 }]}
              onPress={sendMessage}
              activeOpacity={0.9}
              disabled={!canSend}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** ==== styles (기존 그대로) ==== */
const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const BOT = '#CBA4F8';
const USER = '#c093f3ff';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';
const SHADOW = 'rgba(0,0,0,0.08)';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 56,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: { color: TEXT_MAIN, fontSize: 17, fontWeight: '700' },
  headerIcon: { color: TEXT_SUB, fontSize: 22 },

  heroWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: BG, zIndex: 10 },
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginBottom: 4,
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    shadowColor: SHADOW, shadowOpacity: 0.8, shadowRadius: 12, elevation: 1,
  },
  heroImage: {
    width: 64, height: 64, borderRadius: 16, borderWidth: 1, borderColor: '#E9D0EE', backgroundColor: '#F4E6F8',
  },
  heroName: { fontSize: 20, fontWeight: '800', color: TEXT_MAIN, marginBottom: 4 },
  heroDesc: { fontSize: 14, color: TEXT_SUB },
  stopBtn: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  stopText: { color: TEXT_MAIN, fontWeight: '700' },

  msgRow: { marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },

  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F4E6F8', borderWidth: 1, borderColor: '#EAD6F0', marginRight: 8,
  },
  bubble: { maxWidth: '80%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, position: 'relative' },
  theirs: { backgroundColor: BOT, borderTopLeftRadius: 4 },
  mine: { backgroundColor: USER, borderTopRightRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  mineText: { color: '#101114' },
  theirsText: { color: '#101114' },

  tailBase: { position: 'absolute', bottom: 0, width: 10, height: 10, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -4, backgroundColor: BOT },
  tailRight: { right: -4, backgroundColor: USER },

  inputWrap: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD },
  plusBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0F1F5',
    alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 16, top: 16, zIndex: 2,
  },
  plusText: { color: TEXT_MAIN, fontSize: 20, lineHeight: 20 },
  inputPill: {
    flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 52, paddingRight: 6, paddingVertical: 6,
    backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: BORDER, borderRadius: 22,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 8, color: TEXT_MAIN, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER, marginLeft: 6 },
  sendIcon: { color: TEXT_MAIN, fontSize: 16, fontWeight: '700' },
});