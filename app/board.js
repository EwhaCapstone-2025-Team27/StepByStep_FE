import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';
const PAGE_SIZE = 10;

const formatKST = (iso) => {
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseLiked = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return ['true', '1', 'y', 'yes', 'on'].includes(lowered);
  }
  return false;
};

const normalizeListPost = (item, idx = 0) => {
  if (!item || typeof item !== 'object') return null;
  const rawId =
      item.id ?? item.postId ?? item.postID ?? item.post_id ?? item.uuid ?? item._id ?? idx;
  const comments = toNumber(
      item.commentsNum ?? item.commentCount ?? item.comments ?? item.commentCnt ?? item.commentsNum,
      0
  );
  const likes = toNumber(
      item.likesNum ?? item.likeNum ?? item.likes ?? item.likeCount ?? item.likesCnt,
      0
  );
  return {
    id: String(rawId),
    nickname: item.nickname ?? item.writer ?? item.author ?? '익명',
    createdAt:
        item.createdAt ?? item.created_at ?? item.createDate ?? item.createdDate ?? new Date().toISOString(),
    content: item.content ?? item.body ?? '',
    commentsNum: comments,
    likesNum: likes,
    liked: parseLiked(
        item.liked ?? item.isLiked ?? item.likeYn ?? item.likeOn ?? item.likeStatus ?? false
    ),
    authorId: item.authorId ?? item.userId ?? item.ownerId ?? null,
    isMine: typeof item.isMine === 'boolean' ? item.isMine : undefined,
    likeBusy: false,
  };
};

const determineHasMore = (payload, receivedLength, pageNumber, pageSize) => {
  if (!payload || typeof payload !== 'object') {
    return receivedLength >= pageSize;
  }
  if (typeof payload.last === 'boolean') return !payload.last;
  if (typeof payload.hasMore === 'boolean') return payload.hasMore;
  if (typeof payload.hasNext === 'boolean') return payload.hasNext;
  if (payload.pageable?.pageNumber != null && payload.pageable?.totalPages != null) {
    return payload.pageable.pageNumber + 1 < payload.pageable.totalPages;
  }
  if (typeof payload.totalPages === 'number') {
    return pageNumber + 1 < payload.totalPages;
  }
  if (typeof payload.totalElements === 'number') {
    return (pageNumber + 1) * pageSize < payload.totalElements;
  }
  if (typeof payload.pages === 'number' && typeof payload.page === 'number') {
    return payload.page + 1 < payload.pages;
  }
  if (typeof payload.nextPage === 'number') {
    return payload.nextPage > pageNumber;
  }
  return receivedLength >= pageSize;
};

const isMineByUser = (item, meId, meNickname) => {
  if (!item) return false;
  if (typeof item.isMine === 'boolean') return item.isMine;
  if (item.authorId && meId && String(item.authorId) === String(meId)) return true;
  const nick = (item.nickname || '').trim().toLowerCase();
  const meNick = (meNickname || '').trim().toLowerCase();
  return nick && meNick && nick === meNick;
};

export default function BoardScreen() {
  const { user } = (useAuth?.() || {});
  const meId = user?.userId ?? user?.id ?? user?.user_id ?? null;
  const meNickname = user?.nickname ?? user?.profile?.nickname ?? user?.name ?? null;

  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState('');
  const [initialFetched, setInitialFetched] = useState(false);

  const keywordRef = useRef('');

  const loadPosts = useCallback(
      async ({ page: pageParam = 0, append = false, keyword } = {}) => {
        const queryKeyword = keyword ?? keywordRef.current ?? '';

        if (append) setLoadingMore(true);
        else if (initialFetched) setRefreshing(true);
        else setLoading(true);

        try {
          const payload = await boardApi.getPosts({
            page: pageParam,
            size: PAGE_SIZE,
            keyword: queryKeyword,
          });

          const listSource = Array.isArray(payload?.content)
              ? payload.content
              : Array.isArray(payload)
                  ? payload
                  : Array.isArray(payload?.data)
                      ? payload.data
                      : [];

          const normalized = listSource
              .map((item, idx) => normalizeListPost(item, idx))
              .filter(Boolean);

          setPosts((prev) => (append ? [...prev, ...normalized] : normalized));
          setPage(pageParam);
          setHasMore(determineHasMore(payload, normalized.length, pageParam, PAGE_SIZE));
        } catch (e) {
          if (e?.status === 404) {
            if (!append) {
              setPosts([]);
              setPage(0);
              setHasMore(false);
            }
          } else {
            console.error('[BOARD] load error', e);
            Alert.alert('불러오기 실패', e?.message || '게시글을 불러오지 못했습니다.');
          }
        } finally {
          setInitialFetched(true);
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      },
      [initialFetched]
  );

  useFocusEffect(
      useCallback(() => {
        loadPosts({ page: 0, keyword: keywordRef.current });
      }, [loadPosts])
  );

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === keywordRef.current) return;
    const timer = setTimeout(() => {
      keywordRef.current = trimmed;
      loadPosts({ page: 0, keyword: trimmed });
    }, 400);
    return () => clearTimeout(timer);
  }, [search, loadPosts]);

  const onRefresh = useCallback(() => {
    if (loading || refreshing) return;
    loadPosts({ page: 0, keyword: keywordRef.current });
  }, [loadPosts, loading, refreshing]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loading || refreshing || loadingMore) return;
    loadPosts({ page: page + 1, append: true, keyword: keywordRef.current });
  }, [hasMore, loading, refreshing, loadingMore, loadPosts, page]);

  const onCreate = useCallback(async () => {
    const body = content.trim();
    if (!body) {
      Alert.alert('내용을 입력해주세요');
      return;
    }
    try {
      const created = await boardApi.createPost({ content: body });
      const normalized = normalizeListPost(created);
      setContent('');
      setComposeOpen(false);
      if (normalized) {
        setPosts((prev) => [normalized, ...prev]);
      } else {
        await loadPosts({ page: 0, keyword: keywordRef.current });
      }
    } catch (e) {
      if (e?.status === 400) Alert.alert('작성 실패', '내용을 입력해주세요.');
      else Alert.alert('작성 실패', e?.message || '게시글을 작성하지 못했습니다.');
    }
  }, [content, loadPosts]);

  const onToggleLike = useCallback(async (item) => {
    if (!item) return;
    const targetId = item.id;
    const optimisticLike = !item.liked;

    setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== targetId) return p;
          const likes = toNumber(p.likesNum);
          const nextLikes = optimisticLike ? likes + 1 : Math.max(0, likes - 1);
          return { ...p, liked: optimisticLike, likesNum: nextLikes, likeBusy: true };
        })
    );

    try {
      const res = optimisticLike
          ? await boardApi.likeOn(targetId, { likeNum: item.likesNum })
          : await boardApi.likeOff(targetId);

      const likesFromRes =
          res?.likesNum ?? res?.likeNum ?? res?.likes ?? res?.likeCount ?? res?.data?.likesNum;
      const likedFromRes = res?.liked ?? res?.isLiked ?? res?.likeYn ?? res?.likeStatus;

      setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== targetId) return p;
            return {
              ...p,
              likesNum: likesFromRes !== undefined ? toNumber(likesFromRes) : p.likesNum,
              liked: likedFromRes !== undefined ? parseLiked(likedFromRes) : p.liked,
              likeBusy: false,
            };
          })
      );
    } catch (e) {
      setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== targetId) return p;
            const likes = toNumber(p.likesNum);
            const restoredLikes = optimisticLike ? Math.max(0, likes - 1) : likes + 1;
            return { ...p, liked: !optimisticLike, likesNum: restoredLikes, likeBusy: false };
          })
      );
      Alert.alert('좋아요 실패', e?.message || '좋아요 처리에 실패했습니다.');
    }
  }, []);

  const onDelete = useCallback((id) => {
    Alert.alert('삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await boardApi.deletePost(id);
            setPosts((prev) => prev.filter((p) => p.id !== id));
          } catch (e) {
            Alert.alert('삭제 실패', e?.message || '게시글을 삭제하지 못했습니다.');
          }
        },
      },
    ]);
  }, []);

  const renderItem = useCallback(
      ({ item }) => {
        const mine = isMineByUser(item, meId, meNickname);
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
                <Text style={styles.cardDate}>{formatKST(item.createdAt)}</Text>
              </View>

              <Text style={styles.cardBody}>{item.content}</Text>

              <View style={styles.cardActions}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>💬 {toNumber(item.commentsNum)}</Text>
                </View>

                <Pressable
                    style={styles.pill}
                    onPress={(e) => {
                      e.stopPropagation();
                      onToggleLike(item);
                    }}
                    disabled={item.likeBusy}
                    hitSlop={6}
                >
                  <Text style={styles.pillText}>
                    {item.liked ? '💖' : '❤️'} {toNumber(item.likesNum)}
                  </Text>
                </Pressable>

                <View style={{ flex: 1 }} />

                {mine && (
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
                )}
              </View>
            </TouchableOpacity>
        );
      },
      [meId, meNickname, onDelete, onToggleLike]
  );

  const listEmpty = useMemo(() => {
    if (loading || refreshing) return <Text style={styles.empty}>불러오는 중…</Text>;
    return <Text style={styles.empty}>게시글이 없습니다.</Text>;
  }, [loading, refreshing]);

  const listFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ textAlign: 'center', color: '#9ca3af' }}>불러오는 중…</Text>
        </View>
    );
  }, [loadingMore]);

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
          <TouchableOpacity style={styles.composeBtn} onPress={() => setComposeOpen(true)}>
            <Text style={styles.composeBtnText}>글쓰기</Text>
          </TouchableOpacity>
        </View>

        <FlatList
            data={posts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={listFooter}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
        />

        <Modal
            visible={composeOpen}
            animationType="slide"
            onRequestClose={() => setComposeOpen(false)}
        >
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