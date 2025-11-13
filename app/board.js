import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { boardApi } from '../lib/apiClient';
import { useAuth } from '../lib/auth-context';

const MY_POSTS_KEY = 'board_my_posts_v1';

const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';

const toISODateString = (value) => {
  if (value == null) return null;
  const normalizeNumber = (num) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return null;
    const ms = String(Math.trunc(Math.abs(n))).length === 10 ? n * 1000 : n;
    return new Date(ms).toISOString();
  };

  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number') {
    return normalizeNumber(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
    return trimmed;
  }
  if (typeof value === 'object') {
    if (value.date) return toISODateString(value.date);
    if (value.value) return toISODateString(value.value);
    if (value.timestamp) return toISODateString(value.timestamp);
    if (value.seconds) return toISODateString(Number(value.seconds) * 1000);
    if (value._seconds) return toISODateString(Number(value._seconds) * 1000);
  }
  return null;
};

const pickDateValue = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = toISODateString(candidate);
    if (normalized) return normalized;
  }
  return null;
};

// const formatKST = (iso) => {
//   if (!iso) return '-';
//   try {
//     const d = new Date(iso);
//     if (Number.isNaN(d.getTime())) return '-';
//     const yyyy = d.getFullYear();
//     const mm = String(d.getMonth() + 1).padStart(2, '0');
//     const dd = String(d.getDate()).padStart(2, '0');
//     const hh = String(d.getHours()).padStart(2, '0');
//     const min = String(d.getMinutes()).padStart(2, '0');
//     return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
//   } catch {
//     return '-';
//   }
// };

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return ['true', '1', 'y', 'yes', 'on'].includes(lowered);
  }
  return false;
};

const normalizePost = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const idValue =
      raw.id ?? raw.postId ?? raw.post_id ?? raw.postID ?? raw.uuid ?? raw._id ?? raw.boardPostId;
  if (idValue == null) return null;
  const likes = toNumber(
      raw.likesNum ??
      raw.likeNum ??
      raw.likes ??
      raw.likes_count ??
      raw.likesCount ??
      raw.likeCount ??
      raw.totalLikes ??
      raw.like_cnt
  );
  const comments = toNumber(
      raw.commentsNum ??
      raw.commentCount ??
      raw.comments_count ??
      raw.comments ??
      raw.commentCnt ??
      raw.totalComments ??
      raw.comment_cnt
  );
  const nickname =
      raw.nickname ??
      raw.authorNickname ??
      raw.author_nickname ??
      raw.author ??
      raw.userNickname ??
      '익명';
  const createdAt = raw.created_at;
  const authorId =
      raw.authorId ??
      raw.userId ??
      raw.user_id ??
      raw.ownerId ??
      raw.writerId ??
      raw.author?.id ??
      raw.user?.id ??
      null;
  const mineRaw =
      raw.isMine ??
      raw.mine ??
      raw.owned ??
      raw.isOwned ??
      raw.owner ??
      raw.mineYn ??
      raw.mineYN ??
      raw.isAuthor ??
      raw.isWriter ??
      undefined;

  return {
    id: raw.id ?? raw.commentId ?? raw.commentID ?? raw.uuid ?? raw._id,
    nickname: raw.nickname ?? raw.writer ?? raw.author ?? '익명',
    content: raw.content ?? raw.comments ?? raw.body ?? '',
    createdAt:
        raw.createdAt ?? raw.created_at ?? raw.createDate ?? raw.createdDate ?? new Date().toISOString(),
    authorId: raw.authorId ?? raw.userId ?? raw.ownerId ?? raw.writerId ?? raw.author?.id ?? null,
    isMine: mineRaw !== undefined ? parseLiked(mineRaw) : undefined,
  };
};

const extractList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.page && Array.isArray(payload.page.content)) return payload.page.content;
  return [];
};

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState('create');
  const [editingPostId, setEditingPostId] = useState(null);
  const [content, setContent] = useState('');
  const [meId, setMeId] = useState(null);
  const [meNickname, setMeNickname] = useState('');
  const [myPosts, setMyPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const myPostSet = useMemo(() => new Set(myPosts.map((id) => String(id))), [myPosts]);

  useEffect(() => {
    if (!user) return;
    try {
      const rawId = user.userId ?? user.id ?? user.user_id ?? user.uuid;
      if (rawId != null) {
        const strId = String(rawId);
        setMeId(strId);
        AsyncStorage.setItem('user_id', strId).catch(() => {});
      }
      const nickname =
          user.nickname ??
          user.profile?.nickname ??
          user.name ??
          user.username ??
          user.userNickname ??
          '';
      if (nickname) {
        setMeNickname(nickname);
        AsyncStorage.setItem('user_nickname', nickname).catch(() => {});
      }
      AsyncStorage.setItem('user', JSON.stringify(user)).catch(() => {});
    } catch (error) {
      console.warn('Failed to sync auth user', error);
    }
  }, [user]);

  useEffect(() => {
    if (meId && meNickname) return;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!meId) {
            const fallbackId = parsed?.userId ?? parsed?.id ?? parsed?.user_id ?? parsed?.uuid;
            if (fallbackId != null) setMeId(String(fallbackId));
          }
          if (!meNickname) {
            const fallbackNick =
                parsed?.nickname ??
                parsed?.profile?.nickname ??
                parsed?.name ??
                parsed?.username ??
                parsed?.userNickname;
            if (fallbackNick) setMeNickname(fallbackNick);
          }
        }
        if (!meId) {
          const storedId = await AsyncStorage.getItem('user_id');
          if (storedId) setMeId(storedId);
        }
        if (!meNickname) {
          const storedNick = await AsyncStorage.getItem('user_nickname');
          if (storedNick) setMeNickname(storedNick);
        }
      } catch (error) {
        console.warn('Failed to restore user profile', error);
      }
    })();
  }, [meId, meNickname]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MY_POSTS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMyPosts(parsed.map((id) => String(id)));
        }
      } catch (error) {
        console.warn('Failed to load my posts cache', error);
      }
    })();
  }, []);

  const markOwnedPost = useCallback((id) => {
    if (id == null) return;
    const strId = String(id);
    setMyPosts((prev) => {
      if (prev.includes(strId)) return prev;
      const next = [...prev, strId];
      AsyncStorage.setItem(MY_POSTS_KEY, JSON.stringify(next)).catch((error) =>
          console.warn('Failed to persist my posts', error)
      );
      return next;
    });
  }, []);

  const unmarkOwnedPost = useCallback((id) => {
    if (id == null) return;
    const strId = String(id);
    setMyPosts((prev) => {
      if (!prev.includes(strId)) return prev;
      const next = prev.filter((pid) => pid !== strId);
      AsyncStorage.setItem(MY_POSTS_KEY, JSON.stringify(next)).catch((error) =>
          console.warn('Failed to persist my posts', error)
      );
      return next;
    });
  }, []);

  const buildPostPayload = useCallback(
      (contentValue) => ({
        content: contentValue,
        ...(meNickname
            ? {
              authorNickname: meNickname,
              author_nickname: meNickname,
              nickname: meNickname,
            }
            : {}),
        ...(meId
            ? {
              userId: meId,
              user_id: meId,
            }
            : {}),
      }),
      [meId, meNickname]
  );

  const fetchPosts = useCallback(async () => {
    setRefreshing(true);
    try {
      const payload = await boardApi.getPosts();
      const rows = extractList(payload);
      const normalized = rows.map(normalizePost).filter(Boolean);
      setPosts(normalized);
    } catch (error) {
      console.warn('Failed to load posts', error);
      Alert.alert('게시글 불러오기 실패', error?.message || '게시글을 불러오지 못했어요.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
      useCallback(() => {
        fetchPosts();
      }, [fetchPosts])
  );

  const isPostMine = useCallback(
      (post) => {
        if (!post) return false;
        if (post.isMine !== undefined) return !!post.isMine;
        if (post.authorId && meId && String(post.authorId) === String(meId)) return true;
        const postNick = (post.nickname || '').trim().toLowerCase();
        const myNick = (meNickname || '').trim().toLowerCase();
        if (postNick && myNick && postNick === myNick) return true;
        if (post.id && myPostSet.has(String(post.id))) return true;
        return false;
      },
      [meId, meNickname, myPostSet]
  );

  const handleCreateOrUpdate = async () => {
    const body = content.trim();
    if (!body) {
      Alert.alert('내용을 입력해주세요');
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      if (composeMode === 'edit' && editingPostId) {
        const target = posts.find((p) => p.id === editingPostId);
        if (target && !isPostMine(target)) {
          Alert.alert('수정 불가', '본인이 작성한 글만 수정할 수 있어요.');
          setSaving(false);
          return;
        }
        const updated = await boardApi.updatePost(editingPostId, buildPostPayload(body));
        const normalized = normalizePost(updated);
        if (normalized) {
          markOwnedPost(normalized.id);
          setPosts((prev) => prev.map((p) => (p.id === normalized.id ? normalized : p)));
        } else {
          await fetchPosts();
        }
      } else {
        const created = await boardApi.createPost(buildPostPayload(body));
        const normalized = normalizePost(created);
        if (normalized) {
          markOwnedPost(normalized.id);
          setPosts((prev) => [normalized, ...prev]);
        } else {
          await fetchPosts();
        }
      }
      setContent('');
      setEditingPostId(null);
      setComposeMode('create');
      setComposeOpen(false);
    } catch (error) {
      console.warn('Failed to save post', error);
      Alert.alert('게시글 저장 실패', error?.message || '게시글을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    const target = posts.find((p) => p.id === id);
    if (!isPostMine(target)) {
      Alert.alert('삭제 불가', '본인이 작성한 글만 삭제할 수 있어요.');
      return;
    }

    Alert.alert('삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await boardApi.deletePost(id);
            setPosts((prev) => prev.filter((p) => p.id !== id));
            unmarkOwnedPost(id);
          } catch (error) {
            console.warn('Failed to delete post', error);
            Alert.alert('삭제 실패', error?.message || '게시글을 삭제하지 못했어요.');
          }
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      const content = (p.content || '').toLowerCase();
      const nickname = (p.nickname || '').toLowerCase();
      return content.includes(q) || nickname.includes(q);
    });
  }, [posts, search]);

  const openComposeForCreate = () => {
    setComposeMode('create');
    setEditingPostId(null);
    setContent('');
    setComposeOpen(true);
  };

  const openComposeForEdit = (item) => {
    setComposeMode('edit');
    setEditingPostId(item.id);
    setContent(item.content ?? '');
    setComposeOpen(true);
  };

  const renderItem = ({ item }) => {
    const mine = isPostMine(item);
    return (
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
            <Text style={styles.cardDate}>{item.createdAt}</Text>
          </View>

          <Text style={styles.cardBody}>{item.content}</Text>

          <View style={styles.cardActions}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>💬 {item.commentsNum ?? 0}</Text>
            </View>

            <View style={styles.pill}>
              <Text style={styles.pillText}>❤️ {item.likesNum ?? 0}</Text>
            </View>

            <View style={{ flex: 1 }} />

            {mine && (
                <View style={styles.ownerActions}>
                  <Pressable
                      style={[styles.pill, styles.ownerButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        openComposeForEdit(item);
                      }}
                      hitSlop={6}
                  >
                    <Text style={[styles.pillText, styles.ownerText]}>수정</Text>
                  </Pressable>

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
            )}
          </View>
        </TouchableOpacity>
    );
  };

  return (
      <SafeAreaView style={styles.safe}>
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

        <View style={styles.searchRow}>
          <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="검색: 내용/닉네임"
              placeholderTextColor="#9ca3af"
              style={styles.search}
              returnKeyType="search"
          />
          <TouchableOpacity style={styles.composeBtn} onPress={openComposeForCreate}>
            <Text style={styles.composeBtnText}>글쓰기</Text>
          </TouchableOpacity>
        </View>

        <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={styles.empty}>첫 글을 남겨 보세요!</Text>}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={fetchPosts}
        />

        <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
          <KeyboardAvoidingView
              style={[styles.modalSafe, { paddingTop: insets.top + 8 }]}
              behavior={Platform.select({ ios: 'padding', android: undefined })}
          >
            <View style={styles.modalHeader}>
              <Pressable
                  onPress={() => {
                    setComposeOpen(false);
                    setComposeMode('create');
                    setEditingPostId(null);
                    setContent('');
                  }}
              >
                <Text style={styles.cancel}>닫기</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{composeMode === 'edit' ? '게시글 수정' : '새 글 쓰기'}</Text>
              <View style={{ width: 48 }} />
            </View>

            <View style={styles.modalBody}>
              <View style={styles.nicknameBox}>
                <Text style={styles.nicknameLabel}>작성자</Text>
                <Text style={styles.nicknameValue}>{meNickname || '익명'}</Text>
              </View>
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
              <TouchableOpacity
                  style={[styles.submit, saving && styles.submitDisabled]}
                  onPress={handleCreateOrUpdate}
                  activeOpacity={0.9}
                  disabled={saving}
              >
                <Text style={styles.submitText}>{saving ? '처리 중...' : composeMode === 'edit' ? '수정하기' : '게시하기'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
  );
}

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
  ownerActions: { flexDirection: 'row', gap: 8 },
  ownerButton: { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  ownerText: { color: '#111827' },

  empty: { textAlign: 'center', color: '#9ca3af', paddingTop: 48 },

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
  nicknameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  nicknameLabel: { color: '#6b7280', fontWeight: '600' },
  nicknameValue: { color: '#111827', fontWeight: '700' },
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
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontWeight: '800' },
});