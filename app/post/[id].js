import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const STORAGE_KEY = 'board_posts_v1'; // board.js와 동일 키

const formatKST = (iso) => {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
  } catch {
    return iso ?? '';
  }
};

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [liked, setLiked] = useState(false); // 내 좋아요 상태(기본 로컬)
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');

  const commentCount = comments.length;

  // ──────────────────────────────────────────────
  // 1) 데이터 로딩: 서버 → 실패 시 AsyncStorage 폴백
  // ──────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // ▽▽▽ 나중에 서버 붙이면 이 블럭을 사용 ▽▽▽
        // const r = await fetch(`${process.env.EXPO_PUBLIC_API}/api/posts/${id}`);
        // if (!r.ok) throw new Error('failed');
        // const data = await r.json(); // { post, comments, liked }
        // if (!alive) return;
        // setPost(data.post);
        // setComments(data.comments ?? []);
        // setLiked(!!data.liked);
        // ▽▽▽ 임시로 폴백 실행을 위해 일부러 에러 던짐 ▽▽▽
        throw new Error('offline');
      } catch {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          const arr = raw ? JSON.parse(raw) : [];
          const found = arr.find((p) => String(p.id) === String(id));
          if (!alive) return;
          setPost(found ?? null);
          // 로컬에는 댓글 저장이 아직 없으니 빈 배열로 시작
          setComments(found?.comments ?? []);
          setLiked(false);
        } catch (e) {
          console.warn('fallback failed', e);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // ──────────────────────────────────────────────
  // 2) 좋아요 토글
  // ──────────────────────────────────────────────
  const toggleLike = async () => {
    if (!post) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    const nextLikes = (post.likes || 0) + (nextLiked ? 1 : -1);
    setPost({ ...post, likes: Math.max(0, nextLikes) });

    try {
      // 서버 연결 시:
      // await fetch(`${process.env.EXPO_PUBLIC_API}/api/posts/${id}/like`, {
      //   method: nextLiked ? 'POST' : 'DELETE',
      //   headers: { 'Content-Type': 'application/json' }
      // });

      // 로컬에도 반영(목록 동기화 용)
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const updated = arr.map((p) =>
        String(p.id) === String(id) ? { ...p, likes: Math.max(0, nextLikes) } : p
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      Alert.alert('오류', '좋아요 처리에 실패했어요.');
    }
  };

  // ──────────────────────────────────────────────
  // 3) 댓글 등록
  // ──────────────────────────────────────────────
  const onSubmitComment = async () => {
    const text = commentInput.trim();
    if (!text) return;
    const newC = {
      id: String(Date.now()),
      nickname: '익명', // 로그인/닉네임 붙이면 교체
      text,
      createdAt: new Date().toISOString(),
    };

    // 서버 먼저 시도 → 실패 시 로컬 반영
    try {
      // 서버 연결 시:
      // const r = await fetch(`${process.env.EXPO_PUBLIC_API}/api/posts/${id}/comments`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ text }),
      // });
      // if (!r.ok) throw new Error('failed');
      // const saved = await r.json(); // { id, nickname, text, createdAt }
      // setComments((prev) => [...prev, saved]);
      // 로컬 목록에도 댓글 수를 저장하려면 스키마 추가 필요(여기선 count만 동기화)
      throw new Error('offline');
    } catch {
      setComments((prev) => [...prev, newC]);

      // 목록에도 댓글 카운트 필드 반영해두면 좋아요(선택)
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        const updated = arr.map((p) =>
          String(p.id) === String(id)
            ? { ...p, commentCount: (p.commentCount || 0) + 1 }
            : p
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        // 무시
      }
    } finally {
      setCommentInput('');
    }
  };

  // ──────────────────────────────────────────────
  // 4) 렌더
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={S.back}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={S.title}>게시글</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 16 }}>
          <Text>게시글을 찾을 수 없어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      {/* 상단 헤더 */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={S.back}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={S.title}>게시글</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.select({ ios: 8, android: 0 })}
      >
        <FlatList
          ListHeaderComponent={
            <>
              {/* 본문 카드 */}
              <View style={S.card}>
                <View style={S.metaRow}>
                  <Text style={S.nickname}>{post.nickname || '익명'}</Text>
                  <Text style={S.dot}>·</Text>
                  <Text style={S.time}>{formatKST(post.createdAt)}</Text>
                </View>
                <Text style={S.body}>{post.content}</Text>

                {/* 액션바: 좋아요/댓글 수 */}
                <View style={S.actions}>
                  <Pressable onPress={toggleLike} style={S.actionBtn} hitSlop={8}>
                    <Text style={[S.actionIcon, liked && { color: '#ef4444' }]}>
                      {liked ? '♥' : '♡'}
                    </Text>
                    <Text style={S.actionText}>{post.likes || 0}</Text>
                  </Pressable>

                  <View style={S.sep} />

                  <View style={S.actionBtn}>
                    <Text style={S.actionIcon}>💬</Text>
                    <Text style={S.actionText}>{commentCount}</Text>
                  </View>
                </View>
              </View>

              {/* 구분선 + "댓글 n" */}
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>댓글 {commentCount}</Text>
              </View>
            </>
          }
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <View style={S.comment}>
              <View style={S.commentHeader}>
                <Text style={S.commentNick}>{item.nickname || '익명'}</Text>
                <Text style={S.commentTime}>{formatKST(item.createdAt)}</Text>
              </View>
              <Text style={S.commentText}>{item.text}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 88 }}
        />

        {/* 댓글 입력 바 */}
        <View style={S.inputBar}>
          <TextInput
            value={commentInput}
            onChangeText={setCommentInput}
            placeholder="댓글을 입력하세요"
            placeholderTextColor="#9CA3AF"
            style={S.input}
            multiline
          />
          <TouchableOpacity style={S.send} onPress={onSubmitComment} activeOpacity={0.9}>
            <Text style={S.sendText}>등록</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  // 헤더
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 28, lineHeight: 28, color: '#374151' },
  title: { fontSize: 18, fontFamily: 'PretendardBold', color: '#111827' },

  // 본문 카드
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
    marginTop: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  nickname: { fontFamily: 'PretendardBold', fontSize: 15, color: '#111827' },
  dot: { marginHorizontal: 6, color: '#9CA3AF' },
  time: { fontSize: 13, color: '#6B7280' },
  body: { fontSize: 16, color: '#111827', lineHeight: 22, marginTop: 4 },

  // 액션바
  actions: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 18, color: '#6B7280' },
  actionText: { fontSize: 14, color: '#111827', fontFamily: 'PretendardMedium' },
  sep: { width: 1, height: 16, backgroundColor: '#E5E7EB' },

  // 댓글
  sectionHeader: { paddingHorizontal: 2, paddingVertical: 12 },
  sectionTitle: { fontSize: 14, color: '#6B7280', fontFamily: 'PretendardMedium' },

  comment: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 10,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentNick: { fontFamily: 'PretendardBold', fontSize: 14, color: '#111827' },
  commentTime: { fontSize: 12, color: '#9CA3AF' },
  commentText: { fontSize: 15, color: '#111827', lineHeight: 20 },

  // 입력 바
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  send: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 14, fontFamily: 'PretendardMedium' },
});