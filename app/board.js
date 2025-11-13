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
import { useAuth } from '../lib/auth-context';
import { boardApi } from '../lib/apiClient';

// 간단한 유틸
const nowISO = () => new Date().toISOString();
const formatKST = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
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
      raw.likes_count ?? raw.likesNum ?? raw.likeNum ?? raw.likes ?? raw.likeCount ?? raw.likesCnt
  );
  const comments = toNumber(
      raw.comments_count ?? raw.commentCount ?? raw.comments ?? raw.commentCnt ?? raw.commentsNum
  );
  const nickname =
      raw.author_nickname ??
      raw.nickname ??
      raw.userNickname ??
      '익명';
  const createdAt =
      raw.created_at ?? raw.createdAt ?? raw.createDate ?? raw.createdDate ?? new Date().toISOString();
  const authorId = raw.user_id ?? raw.userId ?? raw.authorId ?? raw.ownerId;
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
    id: String(idValue),
    nickname,
    createdAt,
    content: raw.content ?? raw.body ?? '',
    commentsNum: comments,
    likesNum: likes,
    authorId: authorId != null ? String(authorId) : null,
    isMine: mineRaw !== undefined ? parseBoolean(mineRaw) : undefined,
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
  console.log('auth.user in BoardScreen >>>', auth?.user);
  const auth = useAuth?.();
  const userNickname = auth?.user?.nickname;
  const rawUser = auth?.user;
  const userId =
      rawUser?.id ??
      rawUser?.userId ??
      null;
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState('');
  const [myNickname, setMyNickname] = useState(() => userNickname || '');
  const [myId, setMyId] = useState(() =>
      userId != null ? String(userId) : null
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editContent, setEditContent] = useState('');

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

  useEffect(() => {
    if (userId != null) {
      setMyId(String(userId));
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const storedNick = await AsyncStorage.getItem('user_nickname');
        setMyNickname((prev) => prev || storedNick || '');
      } catch (e) {
        console.warn('Failed to load nickname', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userNickname) return;
    setMyNickname(userNickname);
    AsyncStorage.setItem('user_nickname', userNickname).catch(() => {});
  }, [userNickname]);

  // 저장
  const persist = useCallback(async (nextOrUpdater) => {
    let resolved = [];
    setPosts((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const nextValue =
          typeof nextOrUpdater === 'function'
              ? nextOrUpdater(base)
              : Array.isArray(nextOrUpdater)
                  ? nextOrUpdater
                  : base;
      resolved = Array.isArray(nextValue) ? nextValue : [];
      return resolved;
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resolved || []));
    } catch (e) {
      console.warn('Failed to save posts', e);
    }
  }, []);

  const loadPosts = useCallback(
      async ({ silent = false, suppressAlert = false } = {}) => {
        try {
          if (!silent) setLoading(true);
          const payload = await boardApi.getPosts();
          const list = extractList(payload)
              .map((item) => normalizePost(item))
              .filter(Boolean);
          await persist(list);
        } catch (e) {
          console.warn('Failed to fetch board posts', e);
          if (!suppressAlert) {
            Alert.alert('불러오기 실패', e?.message || '게시글을 불러오지 못했습니다.');
          }
        } finally {
          if (!silent) setLoading(false);
        }
      },
      [persist]
  );

  useFocusEffect(
      useCallback(() => {
        loadPosts();
      }, [loadPosts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts({ silent: true, suppressAlert: true });
    setRefreshing(false);
  }, [loadPosts]);

  const onCreate = async () => {
    const body = content.trim();
    const nickname = (myNickname).trim();
    if (!body) {
      Alert.alert('내용을 입력해주세요');
      return;
    }

    try {
      const payload = { content: body };
      if (nickname) payload.nickname = nickname;
      const created = await boardApi.createPost(payload);
      const normalized =
          normalizePost(created?.data ?? created) ?? {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            content: body,
            nickname: nickname || '익명',
            createdAt: nowISO(),
            likesNum: 0,
            commentsNum: 0,
          };

      await persist((prev) => [normalized, ...(prev || [])]);
      setContent('');
      setComposeOpen(false);
    } catch (e) {
      if (e?.status === 401) {
        Alert.alert('로그인 필요', '로그인 후 글쓰기를 이용해주세요.');
      } else {
        Alert.alert('작성 실패', e?.message || '게시글을 작성하지 못했습니다.');
      }
    }
  };

  const onLike = async (id) => {
    await persist((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return base.map((p) => {
        if (p.id !== id) return p;
        const currentLikes = toNumber(p.likesNum ?? p.likes ?? 0);
        return { ...p, likesNum: currentLikes + 1, likes: currentLikes + 1 };
      });
    });
  };

  const onDelete = async (id) => {
    const target = posts.find((p) => p.id === id);
    const isMine = isPostMine(target);

    if (!isMine) {
      Alert.alert('삭제', '본인이 작성한 글만 삭제할 수 있어요.');
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
          } catch (e) {
            if (e?.status === 401) {
              Alert.alert('로그인 필요', '로그인 후 삭제할 수 있습니다.');
              return;
            }
            if (e?.status === 403) {
              Alert.alert('삭제 불가', '본인이 작성한 글만 삭제할 수 있어요.');
              return;
            }
            if (e?.status === 404) {
              // 이미 삭제된 경우에는 로컬에서만 제거
              console.warn('Post already removed remotely');
            } else {
              Alert.alert('삭제 실패', e?.message || '게시글을 삭제하지 못했습니다.');
              return;
            }
          }
          await persist((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            return base.filter((p) => p.id !== id);
          });
        },
      },
    ]);
  };

  const isPostMine = useCallback(
      (post) => {
        if (!post) return false;
        if (post?.isMine !== undefined) return !!post.isMine;
        if (post.authorId && myId) {
          return String(post.authorId) === String(myId);
        }
        if (myNickname && post.nickname) {
          if (post.nickname === myNickname) return true;
        }
        return false;
      },
      [myId, myNickname]
  );

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setEditTarget(null);
    setEditContent('');
  }, []);

  const openEdit = useCallback(
      (post) => {
        if (!post) return;
        if (!isPostMine(post)) {
          Alert.alert('수정 불가', '본인이 작성한 글만 수정할 수 있어요.');
          return;
        }
        setEditTarget(post);
        setEditContent(post.content ?? '');
        setEditOpen(true);
      },
      [isPostMine]
  );

  const onSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    if (!isPostMine(editTarget)) {
      Alert.alert('수정 불가', '본인이 작성한 글만 수정할 수 있어요.');
      return;
    }
    const body = editContent.trim();
    if (!body) {
      Alert.alert('내용을 입력해주세요');
      return;
    }
    try {
      const id = editTarget.id;
      const payload = await boardApi.updatePost(id, { content: body });
      const normalized = normalizePost(payload?.data ?? payload);
      await persist((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        return base.map((p) => {
          if (p.id !== id) return p;
          if (normalized) {
            return { ...p, ...normalized, content: normalized.content ?? body };
          }
          return { ...p, content: body };
        });
      });
      closeEdit();
    } catch (e) {
      if (e?.status === 401) {
        Alert.alert('로그인 필요', '로그인 후 수정할 수 있습니다.');
        return;
      }
      if (e?.status === 403) {
        Alert.alert('수정 불가', '본인이 작성한 글만 수정할 수 있어요.');
        return;
      }
      Alert.alert('수정 실패', e?.message || '게시글을 수정하지 못했습니다.');
    }
  }, [closeEdit, editContent, editTarget, isPostMine, persist]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => p.content.toLowerCase().includes(q) || p.nickname.toLowerCase().includes(q));
  }, [posts, search]);

  const renderItem = ({ item }) => {
    const isMine = isPostMine(item);
    const likeCount = toNumber(item.likesNum ?? item.likes ?? item.likeCount);
    const commentCount = toNumber(item.commentsNum ?? item.commentCount ?? item.comments);

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
            <Text style={styles.cardNick}>{item.nickname}</Text>
            <Text style={styles.cardDate}>{formatKST(item.createdAt)}</Text>
          </View>

          <Text style={styles.cardBody}>{item.content}</Text>

          <View style={styles.cardActions}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>💬 {commentCount}</Text>
            </View>

            <Pressable
                style={styles.pill}
                onPress={(e) => {
                  e.stopPropagation();
                  onLike(item.id);
                }}
                hitSlop={6}
            >
              <Text style={styles.pillText}>❤️ {likeCount}</Text>
            </Pressable>

            <View style={{ flex: 1 }} />
            {isMine && (
                <>
                  <Pressable
                      style={styles.pill}
                      onPress={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                      hitSlop={6}
                  >
                    <Text style={styles.pillText}>수정</Text>
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
                </>
            )}
          </View>
        </TouchableOpacity>
    );
  };

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
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {search.trim()
                    ? '조건에 맞는 게시글이 없어요.'
                    : loading
                        ? '게시글을 불러오는 중...'
                        : '첫 글을 남겨 보세요! '}
              </Text>
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
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

        <Modal visible={editOpen} animationType="slide" onRequestClose={closeEdit}>
          <KeyboardAvoidingView
              style={[styles.modalSafe, { paddingTop: insets.top + 8 }]}
              behavior={Platform.select({ ios: 'padding', android: undefined })}
          >
            <View style={styles.modalHeader}>
              <Pressable onPress={closeEdit}>
                <Text style={styles.cancel}>닫기</Text>
              </Pressable>
              <Text style={styles.modalTitle}>글 수정</Text>
              <View style={{ width: 48 }} />
            </View>

            <View style={styles.modalBody}>
              <TextInput
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder="수정할 내용을 입력하세요"
                  placeholderTextColor="#9ca3af"
                  style={styles.textarea}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
              />
              <TouchableOpacity style={styles.submit} onPress={onSaveEdit} activeOpacity={0.9}>
                <Text style={styles.submitText}>수정하기</Text>
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