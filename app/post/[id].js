// app/post/[id].js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { boardApi, commentApi } from '../../lib/apiClient';
import { useAuth } from '../../lib/auth-context';

const BG = '#F7F7FA';
const CARD = '#FFFFFF';
const BORDER = '#E6E7EC';
const TEXT_MAIN = '#0E0F12';
const TEXT_SUB = '#5E6472';
const MY_POSTS_KEY = 'board_my_posts_v1';

// const formatKST = (iso) => {
//   try {
//     const d = new Date(iso);
//     const yyyy = d.getFullYear();
//     const mm = String(d.getMonth() + 1).padStart(2, '0');
//     const dd = String(d.getDate()).padStart(2, '0');
//     const hh = String(d.getHours()).padStart(2, '0');
//     const min = String(d.getMinutes()).padStart(2, '0');
//     return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
//   } catch {
//     return iso;
//   }
// };

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

const likedStoreKey = (userId, nickname) => {
  const base = userId ?? (nickname ? nickname : null);
  return base ? `liked_posts_${base}` : 'liked_posts';
};

const normalizePost = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const likes = toNumber(raw.likesNum ?? raw.likeNum ?? raw.likes ?? raw.likeCount);
  const comments = toNumber(
      raw.commentsNum ?? raw.commentCount ?? raw.comments ?? raw.commentCnt ?? raw.commentsNum
  );
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
    id: raw.id ?? raw.postId ?? raw.postID ?? raw.post_id ?? raw.uuid ?? raw._id,
    nickname: raw.nickname ?? raw.writer ?? raw.author,
    createdAt:
        raw.created_at ?? new Date().toISOString(),
    content: raw.content ?? raw.body ?? '',
    commentsNum: comments,
    likesNum: likes,
    liked: parseLiked(raw.liked ?? raw.isLiked ?? raw.likeYn ?? raw.likeStatus ?? raw.likeOn),
    authorId: raw.authorId ?? raw.userId ?? raw.ownerId ?? raw.writerId ?? raw.author?.id ?? null,
    isMine: mineRaw !== undefined ? parseLiked(mineRaw) : undefined,
  };
};

const normalizeComment = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const mineRaw =
      raw.isMine ??
      raw.mine ??
      raw.isOwned ??
      raw.owned ??
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

const isMineByIdsOrNick = ({ authorId, nickname } = {}, meId, meNick) => {
  if (authorId && meId && String(authorId) === String(meId)) return true;
  const a = (nickname || '').trim().toLowerCase();
  const b = (meNick || '').trim().toLowerCase();
  return Boolean(a && b && a === b);
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const postId = id ? String(id) : null;

  const { user } = (useAuth?.() || {});
  const [meId, setMeId] = useState(null);
  const [meNickname, setMeNickname] = useState(null);
  const [myPostIds, setMyPostIds] = useState([]);

  useEffect(() => {
    if (!user) return;
    try {
      const rawId = user.userId ?? user.id ?? user.user_id;
      if (rawId != null) {
        const strId = String(rawId);
        setMeId(strId);
        AsyncStorage.setItem('user_id', strId).catch(() => {});
      }
      const nick = user.nickname ?? user.profile?.nickname ?? user.name;
      if (nick) {
        setMeNickname(nick);
        AsyncStorage.setItem('user_nickname', nick).catch(() => {});
      }
      AsyncStorage.setItem('user', JSON.stringify(user)).catch(() => {});
    } catch {}
  }, [user]);

  useEffect(() => {
    if (meId && meNickname) return;
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (!meId) {
            const fallbackId = parsed?.userId ?? parsed?.id ?? parsed?.user_id;
            if (fallbackId != null) setMeId(String(fallbackId));
          }
          if (!meNickname) {
            const fallbackNick =
                parsed?.nickname ?? parsed?.profile?.nickname ?? parsed?.name;
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
      } catch {}
    })();
  }, [meId, meNickname]);

  useEffect(() => {
    myPostIdsRef.current = new Set((myPostIds || []).map((id) => String(id)));
  }, [myPostIds]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(MY_POSTS_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMyPostIds(parsed.map((id) => String(id)));
        }
      } catch {}
    })();
  }, []);

  const markOwnedPost = useCallback((id) => {
    if (!id) return;
    const stringId = String(id);
    setMyPostIds((prev) => {
      if (prev.includes(stringId)) return prev;
      const next = [...prev, stringId];
      AsyncStorage.setItem(MY_POSTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const unmarkOwnedPost = useCallback((id) => {
    if (!id) return;
    const stringId = String(id);
    setMyPostIds((prev) => {
      if (!prev.includes(stringId)) return prev;
      const next = prev.filter((pid) => pid !== stringId);
      AsyncStorage.setItem(MY_POSTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const insets = useSafeAreaInsets();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likedCache, setLikedCache] = useState({});

  const [myComment, setMyComment] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editText, setEditText] = useState('');

  const [postEditOpen, setPostEditOpen] = useState(false);
  const [postEditText, setPostEditText] = useState('');

  const listRef = useRef(null);
  const likedCacheRef = useRef({});
  const mountedRef = useRef(true);
  const likedKey = useMemo(() => likedStoreKey(meId, meNickname), [meId, meNickname]);
  const myPostIdsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    likedCacheRef.current = likedCache || {};
  }, [likedCache]);

  const loadLikedCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(likedKey);
      if (!mountedRef.current) return;
      if (!raw) {
        setLikedCache({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const normalized = Object.entries(parsed).reduce((acc, [k, v]) => {
          acc[String(k)] = !!v;
          return acc;
        }, {});
        setLikedCache(normalized);
      } else {
        setLikedCache({});
      }
    } catch {
      if (mountedRef.current) setLikedCache({});
    }
  }, [likedKey]);

  useEffect(() => {
    loadLikedCache();
  }, [loadLikedCache]);

  useEffect(() => {
    if (!postId) return;
    const stored = likedCache?.[String(postId)];
    if (stored === undefined) return;
    setPost((prev) => {
      if (!prev) return prev;
      const liked = !!stored;
      if (prev.liked === liked) return prev;
      return { ...prev, liked };
    });
  }, [likedCache, postId]);

  const persistLiked = useCallback(
      async (nextLiked) => {
        if (!postId) return;
        const stringId = String(postId);
        const nextMap = { ...(likedCacheRef.current || {}) };
        nextMap[stringId] = !!nextLiked;
        if (mountedRef.current) {
          setLikedCache(nextMap);
        }
        try {
          await AsyncStorage.setItem(likedKey, JSON.stringify(nextMap));
        } catch {}
      },
      [likedKey, postId]
  );

  const scrollToBottom = useCallback(
      () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true })),
      []
  );

  const orderedComments = useMemo(() => {
    const arr = Array.isArray(comments) ? [...comments] : [];
    return arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  }, [comments]);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const payload = await boardApi.getPostById(postId);
      const normalizedPost = normalizePost(payload);
      const commentSource = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.comments)
              ? payload.comments
              : [];
      const normalizedComments = commentSource
          .map((item) => normalizeComment(item))
          .filter(Boolean);

      if (normalizedPost) {
        const stringId = String(normalizedPost.id);
        const mineLocal = myPostIdsRef.current.has(stringId);
        const mineProfile = isMineByIdsOrNick(normalizedPost, meId, meNickname);
        const mineFromServer = normalizedPost.isMine;
        const isMine = mineFromServer || mineLocal || mineProfile;
        if (isMine) {
          markOwnedPost(stringId);
          setPost({ ...normalizedPost, isMine: true });
        } else {
          setPost(normalizedPost);
        }
      } else {
        setPost(normalizedPost);
      }
      setComments(normalizedComments);
    } catch (e) {
      if (e?.status === 404) {
        Alert.alert('알림', '게시글을 찾을 수 없습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('불러오기 실패', e?.message || '게시글을 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [markOwnedPost, meId, meNickname, postId, scrollToBottom]);

  useEffect(() => {
    if (postId) load();
  }, [postId, load]);

  const onCreateComment = useCallback(async () => {
    const content = myComment.trim();
    if (!content || !postId) return;
    try {
      const created = await commentApi.create(postId, { content });
      const newComment = { ...normalizeComment(created), isMine: true };
      setComments((prev) => [...prev, newComment]);
      setPost((prev) =>
          prev
              ? { ...prev, commentsNum: toNumber(prev.commentsNum) + 1 }
              : prev
      );
      setMyComment('');
      scrollToBottom();
      await AsyncStorage.setItem('last_commented_post', String(postId));
    } catch (e) {
      if (e?.status === 401) {
        Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      } else {
        Alert.alert('작성 실패', e?.message || '댓글을 작성하지 못했습니다.');
      }
    }
  }, [myComment, postId, scrollToBottom]);

  const openEdit = useCallback((comment) => {
    setEditTarget(comment);
    setEditText(comment?.content || '');
    setEditOpen(true);
  }, []);

  const onEditSubmit = useCallback(async () => {
    if (!editTarget) return;
    const content = editText.trim();
    if (!content) return;
    try {
      const updated = await commentApi.update(editTarget.id, { content });
      const normalized = normalizeComment(updated);
      setComments((prev) => prev.map((c) => (c.id === editTarget.id ? normalized : c)));
      setEditOpen(false);
      scrollToBottom();
    } catch (e) {
      Alert.alert('수정 실패', e?.message || '댓글을 수정하지 못했습니다.');
    }
  }, [editTarget, editText, scrollToBottom]);

  const onDeleteComment = useCallback((comment) => {
    if (!comment) return;
    Alert.alert('삭제', '댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await commentApi.delete(comment.id);
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
            setPost((prev) =>
                prev
                    ? { ...prev, commentsNum: Math.max(0, toNumber(prev.commentsNum) - 1) }
                    : prev
            );
          } catch (e) {
            Alert.alert('삭제 실패', e?.message || '댓글을 삭제하지 못했습니다.');
          }
        },
      },
    ]);
  }, []);

  useEffect(() => {
    setPost((prev) => {
      if (!prev) return prev;
      const shouldBeMine =
          prev.isMine ||
          myPostIdsRef.current.has(String(prev.id)) ||
          isMineByIdsOrNick(prev, meId, meNickname);
      if (shouldBeMine && !prev.isMine) {
        return { ...prev, isMine: true };
      }
      return prev;
    });
  }, [meId, meNickname, myPostIds]);

  useEffect(() => {
    if (!post?.isMine) return;
    const id = post.id;
    if (id == null) return;
    const stringId = String(id);
    if (myPostIdsRef.current.has(stringId)) return;
    setMyPostIds((prev) => {
      if (prev.includes(stringId)) return prev;
      const next = [...prev, stringId];
      AsyncStorage.setItem(MY_POSTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [post]);

  const isMinePost = Boolean(
      post &&
      (post.isMine ||
          myPostIdsRef.current.has(String(post.id)) ||
          isMineByIdsOrNick(post, meId, meNickname))
  );

  const onPostEditOpen = useCallback(() => {
    setPostEditText(post?.content || '');
    setPostEditOpen(true);
  }, [post]);

  const onPostEditSave = useCallback(async () => {
    if (!post) return;
    const body = postEditText.trim();
    if (!body) {
      Alert.alert('내용을 입력해주세요');
      return;
    }
    try {
      const updated = await boardApi.updatePost(post.id, { content: body });
      const normalized = normalizePost(updated);
      if (normalized) {
        setPost((prev) =>
            prev
                ? { ...prev, ...normalized, isMine: true }
                : { ...normalized, isMine: true }
        );
      } else {
        setPost((prev) =>
            prev
                ? {
                  ...prev,
                  content: body,
                  createdAt: new Date().toISOString(),
                  isMine: true,
                }
                : prev
        );
      }
      markOwnedPost(post.id);
      setPostEditOpen(false);
    } catch (e) {
      Alert.alert('수정 실패', e?.message || '게시글을 수정하지 못했습니다.');
    }
  }, [markOwnedPost, post, postEditText]);

  const onPostDelete = useCallback(() => {
    if (!post) return;
    const mine =
        post.isMine ||
        myPostIdsRef.current.has(String(post.id)) ||
        isMineByIdsOrNick(post, meId, meNickname);
    if (!mine) {
      Alert.alert('삭제', '본인이 작성한 글만 삭제할 수 있어요.');
      return;
    }
    Alert.alert('삭제', '게시글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await boardApi.deletePost(post.id);
            unmarkOwnedPost(post.id);
            router.back();
          } catch (e) {
            Alert.alert('삭제 실패', e?.message || '게시글을 삭제하지 못했습니다.');
          }
        },
      },
    ]);
  }, [meId, meNickname, post, unmarkOwnedPost]);

  const onToggleLike = useCallback(async () => {
    if (!post || likeBusy) return;
    const optimisticLike = !post.liked;
    setLikeBusy(true);
    setPost((prev) => {
      if (!prev) return prev;
      const likes = toNumber(prev.likesNum);
      const nextLikes = optimisticLike ? likes + 1 : Math.max(0, likes - 1);
      return { ...prev, liked: optimisticLike, likesNum: nextLikes };
    });
    try {
      const res = optimisticLike
          ? await boardApi.likeOn(post.id, { likeNum: post.likesNum })
          : await boardApi.likeOff(post.id);
      const likesFromRes =
          res?.likesNum ?? res?.likeNum ?? res?.likes ?? res?.likeCount ?? res?.data?.likesNum;
      const likedFromRes = res?.liked ?? res?.isLiked ?? res?.likeYn ?? res?.likeStatus;
      const finalLiked =
          likedFromRes !== undefined ? parseLiked(likedFromRes) : optimisticLike;
      setPost((prev) =>
          prev
              ? {
                ...prev,
                likesNum:
                    likesFromRes !== undefined ? toNumber(likesFromRes) : prev.likesNum,
                liked: finalLiked,
              }
              : prev
      );
      persistLiked(finalLiked);
    } catch (e) {
      setPost((prev) => {
        if (!prev) return prev;
        const likes = toNumber(prev.likesNum);
        const restored = optimisticLike ? Math.max(0, likes - 1) : likes + 1;
        return { ...prev, liked: !optimisticLike, likesNum: restored };
      });
      persistLiked(!optimisticLike);
      Alert.alert('좋아요 실패', e?.message || '좋아요 처리에 실패했습니다.');
    } finally {
      setLikeBusy(false);
    }
  }, [post, likeBusy, persistLiked]);

  const renderComment = useCallback(
      ({ item }) => {
        const mine = isMineByIdsOrNick(item, meId, meNickname);
        return (
            <View style={S.cmtCard}>
              <View style={S.cmtHead}>
                <Text style={S.cmtNick}>{item.nickname}</Text>
                <Text style={S.cmtDate}>{item.createdAt}</Text>
              </View>
              <Text style={S.cmtBody}>{item.content}</Text>
              <View style={S.cmtActions}>
                {mine && (
                    <>
                      <Pressable style={S.pill} onPress={() => openEdit(item)}>
                        <Text style={S.pillText}>수정</Text>
                      </Pressable>
                      <Pressable style={[S.pill, S.danger]} onPress={() => onDeleteComment(item)}>
                        <Text style={[S.pillText, { color: '#b91c1c' }]}>삭제</Text>
                      </Pressable>
                    </>
                )}
              </View>
            </View>
        );
      },
      [meId, meNickname, onDeleteComment, openEdit]
  );

  const [showDown, setShowDown] = useState(false);
  const onScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const dist = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setShowDown(dist > 120);
  }, []);

  return (
      <SafeAreaView style={S.safe}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={S.headerIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>게시글 상세</Text>
          <TouchableOpacity onPress={load}>
            <Text style={S.headerIcon}>↻</Text>
          </TouchableOpacity>
        </View>

        {loading && !post ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text>불러오는 중…</Text>
            </View>
        ) : (
            <FlatList
                ref={listRef}
                data={orderedComments}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderComment}
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                ListHeaderComponent={
                  <>
                    {post && (
                        <View style={S.postCardBig}>
                          <View style={S.postHead}>
                            <Text style={S.nickBig}>{post.nickname || '익명'}</Text>
                            <Text style={S.dateBig}>{post.createdAt}</Text>
                          </View>

                          <Text style={S.bodyBig}>{post.content}</Text>

                          <View style={[S.metaRow, { alignItems: 'center' }]}>
                            <Pressable
                                style={S.metaLike}
                                onPress={onToggleLike}
                                disabled={likeBusy}
                                hitSlop={6}
                            >
                              <Text
                                  style={[
                                    S.meta,
                                    { fontWeight: '700', color: post.liked ? '#ec4899' : '#6b7280' },
                                  ]}
                              >
                                {post.liked ? '💖' : '❤️'} {toNumber(post.likesNum)}
                              </Text>
                            </Pressable>
                            <Text style={S.meta}>·</Text>
                            <Text style={S.meta}>💬 {post.commentsNum ?? orderedComments.length}</Text>
                            <View style={{ flex: 1 }} />
                            {isMinePost && (
                                <>
                                  <Pressable style={S.pill} onPress={onPostEditOpen}>
                                    <Text style={S.pillText}>수정</Text>
                                  </Pressable>
                                  <Pressable style={[S.pill, S.danger]} onPress={onPostDelete}>
                                    <Text style={[S.pillText, { color: '#b91c1c' }]}>삭제</Text>
                                  </Pressable>
                                </>
                            )}
                          </View>
                        </View>
                    )}
                    <View style={S.sectionRow}>
                      <Text style={S.sectionTitle}>댓글</Text>
                      <View style={S.sectionLine} />
                    </View>
                  </>
                }
                ListEmptyComponent={!loading && (
                    <Text style={S.empty}>첫 댓글을 남겨 보세요!</Text>
                )}
                refreshing={loading}
                onRefresh={load}
                onContentSizeChange={scrollToBottom}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            />
        )}

        {showDown && (
            <TouchableOpacity style={S.fab} onPress={scrollToBottom} activeOpacity={0.9}>
              <Text style={S.fabIcon}>↓</Text>
            </TouchableOpacity>
        )}

        <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding' })}
            keyboardVerticalOffset={insets.bottom ? 0 : 20}
            style={[S.inputBarWrap, { paddingBottom: insets.bottom || 8 }]}
        >
          <View style={S.inputRow}>
            <TextInput
                value={myComment}
                onChangeText={setMyComment}
                placeholder="댓글을 입력하세요"
                placeholderTextColor="#9ca3af"
                style={[S.input, { flex: 1 }]}
                returnKeyType="send"
                onSubmitEditing={onCreateComment}
            />
            <TouchableOpacity style={S.sendBtn} onPress={onCreateComment}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>등록</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
          <View style={S.modalBg}>
            <View style={S.modal}>
              <Text style={S.modalTitle}>댓글 수정</Text>
              <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  placeholder="수정할 내용"
                  placeholderTextColor="#9ca3af"
                  style={S.editInput}
                  multiline
              />
              <View style={S.modalRow}>
                <TouchableOpacity style={[S.modalBtn, S.modalCancel]} onPress={() => setEditOpen(false)}>
                  <Text style={S.modalBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.modalBtn, S.modalOK]} onPress={onEditSubmit}>
                  <Text style={[S.modalBtnText, { color: '#fff' }]}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
            visible={postEditOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setPostEditOpen(false)}
        >
          <View style={S.modalBg}>
            <View style={S.modal}>
              <Text style={S.modalTitle}>게시글 수정</Text>
              <TextInput
                  value={postEditText}
                  onChangeText={setPostEditText}
                  placeholder="수정할 내용"
                  placeholderTextColor="#9ca3af"
                  style={S.editInput}
                  multiline
              />
              <View style={S.modalRow}>
                <TouchableOpacity style={[S.modalBtn, S.modalCancel]} onPress={() => setPostEditOpen(false)}>
                  <Text style={S.modalBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.modalBtn, S.modalOK]} onPress={onPostEditSave}>
                  <Text style={[S.modalBtnText, { color: '#fff' }]}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

const S = StyleSheet.create({
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
  },
  headerTitle: { color: TEXT_MAIN, fontSize: 17, fontWeight: '700' },
  headerIcon: { color: TEXT_SUB, fontSize: 20 },

  postCardBig: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  postHead: { flexDirection: 'row', alignItems: 'center' },
  nickBig: { fontWeight: '800', color: '#0f172a', fontSize: 16 },
  dateBig: { marginLeft: 10, color: '#64748b', fontSize: 12 },
  bodyBig: { color: '#0f172a', fontSize: 16, lineHeight: 24, marginTop: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  sectionTitle: { fontWeight: '800', color: '#0f172a', marginRight: 10 },
  sectionLine: { height: 1, backgroundColor: '#e5e7eb', flex: 1 },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  meta: { color: '#6b7280', fontSize: 12 },
  metaLike: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  cmtCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cmtHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cmtNick: { fontWeight: '700', color: '#111827' },
  cmtDate: { marginLeft: 8, color: '#6b7280', fontSize: 12 },
  cmtBody: { color: '#111827', lineHeight: 20, marginTop: 2 },

  cmtActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: { fontWeight: '700', color: '#111827' },
  danger: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },

  empty: { textAlign: 'center', color: '#9ca3af', paddingTop: 40 },

  inputBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    color: '#111827',
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fab: {
    position: 'absolute',
    right: 14,
    bottom: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  fabIcon: { color: '#fff', fontSize: 20, fontWeight: '900' },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: TEXT_MAIN },
  editInput: {
    minHeight: 100,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    color: TEXT_MAIN,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  modalCancel: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  modalOK: { backgroundColor: '#111827' },
  modalBtnText: { fontWeight: '700', color: TEXT_MAIN },
});