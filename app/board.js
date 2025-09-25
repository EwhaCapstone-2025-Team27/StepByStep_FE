import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 간단한 유틸
const nowISO = () => new Date().toISOString();
const formatKST = (iso) => {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  } catch {
    return iso;
  }
};

const STORAGE_KEY = 'board_posts_v1'; // 로컬 저장 키

/** ==== Palette & tokens (ChatScreen과 톤 맞춤) ==== */
const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState('');
  const [nick, setNick] = useState('');

  // 최초 로드
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setPosts(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load posts', e);
      }
    })();
  }, []);

  // 저장
  const persist = async (next) => {
    setPosts(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save posts', e);
    }
  };

  const onCreate = async () => {
    const body = content.trim();
    const nickname = (nick || '익명').trim();
    if (!body) {
      Alert.alert('내용을 입력해주세요');
      return;
    }
    const post = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content: body,
      nickname,
      createdAt: nowISO(),
      likes: 0,
      comments: [],
    };

    await persist([post, ...posts]);
    setContent('');
    setComposeOpen(false);
  };

  const onLike = async (id) => {
    const next = posts.map((p) => (p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p));
    await persist(next);
  };

  const onDelete = async (id) => {
    Alert.alert('삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const next = posts.filter((p) => p.id !== id);
          await persist(next);
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => p.content.toLowerCase().includes(q) || p.nickname.toLowerCase().includes(q));
  }, [posts, search]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        router.push({
          pathname: '/post/[id]',
          params: { id: String(item.id) },
        })
      }
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardNick}>{item.nickname || '익명'}</Text>
        <Text style={styles.cardDate}>{formatKST(item.createdAt)}</Text>
      </View>

      <Text style={styles.cardBody}>{item.content}</Text>

      <View style={styles.cardActions}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>💬 {item.commentCount || 0}</Text>
        </View>

        <Pressable
          style={styles.pill}
          onPress={(e) => {
            e.stopPropagation();
            onLike(item.id);
          }}
          hitSlop={6}
        >
          <Text style={styles.pillText}>❤️ {item.likes || 0}</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable
          style={[styles.pill, styles.danger]}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          hitSlop={6}
        >
          <Text style={[styles.pillText, { color: '#b91c1c' }]}>삭제</Text>
        </Pressable>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header (ChatScreen과 동일 패턴) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>익명 게시판</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* 검색 & 글쓰기 */}
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="검색: 내용/닉네임"
          placeholderTextColor="#9ca3af"
          style={styles.search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.composeBtn} onPress={() => setComposeOpen(true)}>
          <Text style={styles.composeBtnText}>글쓰기</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>첫 글을 남겨 보세요! </Text>}
        showsVerticalScrollIndicator={false}
      />

      {/* 글쓰기 모달 */}
      <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <KeyboardAvoidingView
          style={[styles.modalSafe, { paddingTop: insets.top + 8 }]}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setComposeOpen(false)}>
              <Text style={styles.cancel}>닫기</Text>
            </Pressable>
            <Text style={styles.modalTitle}>새 글 쓰기</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.modalBody}>
            <TextInput
              value={nick}
              onChangeText={setNick}
              placeholder="닉네임 (미입력 시 익명)"
              placeholderTextColor="#9ca3af"
              style={styles.nick}
              maxLength={20}
            />
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="내용을 입력하세요 (욕설/개인정보 금지)"
              placeholderTextColor="#9ca3af"
              style={styles.textarea}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <TouchableOpacity style={styles.submit} onPress={onCreate} activeOpacity={0.9}>
              <Text style={styles.submitText}>게시하기</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  /** Header - ChatScreen과 동일 패턴 */
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

  /** 검색 & 액션 */
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BG,
  },
  search: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  composeBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeBtnText: { color: '#fff', fontWeight: '700' },

  /** 카드 */
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardNick: { fontWeight: '700', color: '#111827' },
  cardDate: { marginLeft: 8, color: '#6b7280', fontSize: 12 },
  cardBody: { color: '#111827', lineHeight: 20, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: { fontWeight: '700', color: '#111827' },
  danger: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },

  empty: { textAlign: 'center', color: '#9ca3af', paddingTop: 48 },

  /** 모달 */
  modalSafe: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: { color: '#6b7280', fontWeight: '700' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { padding: 16, gap: 10 },
  nick: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    color: '#111827',
  },
  textarea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    color: '#111827',
  },
  submit: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800' },
});