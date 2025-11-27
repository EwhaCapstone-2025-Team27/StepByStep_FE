// app/home.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { badgeApi, pointsApi, userApi, authApi } from '../lib/apiClient';
import { useAuth } from '../lib/auth-context';

const normalizeBadges = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map((b, idx) => ({
    id: b?.id ?? b?.badgeId ?? b?.code ?? String(idx),
    name: b?.name ?? b?.badgeName ?? b?.title ?? b?.label ?? '배지',
    emoji: b?.emoji ?? b?.icon ?? b?.symbol ?? '🏅',
    owned: b?.owned ?? b?.isOwned ?? b?.hasBadge ?? b?.userHasBadge ?? true,
  }));
};

const mergeOwnedBadges = (...lists) => {
  const map = new Map();

  lists
      .filter(Array.isArray)
      .forEach((list) => {
        list.forEach((badge) => {
          if (!badge || !badge.owned) return;
          const key = badge.id != null ? String(badge.id) : null;
          const safeKey = key ?? `badge-${map.size}`;
          const prev = map.get(safeKey) || {};
          map.set(safeKey, { ...prev, ...badge, id: safeKey });
        });
      });

  return Array.from(map.values());
};

export default function HomeScreen() {
  const auth = useAuth();
  const authUser = auth?.user || {};

  const fallbackNickname = authUser?.nickname ?? '친구';
  const fallbackTitle = authUser?.currentTitle ?? authUser?.title ?? '';
  const fallbackPoints = Number(
      authUser?.points ?? authUser?.points_total ?? authUser?.point ?? 0
  );
  const fallbackAvatar = authUser?.profileImage ?? authUser?.avatarUrl ?? null;
  const fallbackBadges = useMemo(
      () => normalizeBadges(authUser?.badges).filter((b) => b.owned),
      [authUser?.badges]
  );

  const [summary, setSummary] = useState(() => ({
    nickname: fallbackNickname,
    currentTitle: fallbackTitle,
    points_total: Number.isFinite(fallbackPoints) ? fallbackPoints : 0,
    badges: fallbackBadges,
    profileImage: fallbackAvatar,
  }));

  useEffect(() => {
    setSummary((prev) => ({
      ...prev,
      nickname: fallbackNickname,
      currentTitle: fallbackTitle || prev.currentTitle,
      profileImage: fallbackAvatar ?? prev.profileImage,
    }));
  }, [fallbackNickname, fallbackTitle, fallbackAvatar]);

  const loadSummary = useCallback(async () => {
    const [profileRes, pointsRes, badgesRes] = await Promise.allSettled([
      userApi.me(),
      pointsApi.me(),
      badgeApi.list(),
    ]);

    if (
        profileRes.status === 'rejected' &&
        pointsRes.status === 'rejected' &&
        badgesRes.status === 'rejected'
    ) {
      const reason = profileRes.reason || pointsRes.reason || badgesRes.reason;
      if (reason?.status !== 401) {
        Alert.alert('오류', reason?.message || '홈 정보를 불러오지 못했어요.');
      }
      return;
    }

    const profile =
        profileRes.status === 'fulfilled' ? profileRes.value?.user ?? profileRes.value : null;
    const nickname = profile?.nickname ?? fallbackNickname;
    const title =
        profile?.currentTitle ?? profile?.title ?? profile?.levelName ?? profile?.rank ?? fallbackTitle;
    const avatar =
        profile?.profileImage ?? profile?.avatarUrl ?? profile?.imageUrl ?? profile?.photo ?? fallbackAvatar;

    let points = fallbackPoints;
    if (pointsRes.status === 'fulfilled') {
      const v =
          pointsRes.value?.myPoint ??
          pointsRes.value?.points ??
          pointsRes.value?.point ??
          pointsRes.value?.balance ??
          pointsRes.value?.data?.points;
      if (Number.isFinite(Number(v))) points = Number(v);
    } else if (profile) {
      const v =
          profile?.points ??
          profile?.points_total ??
          profile?.point ??
          profile?.wallet?.points ??
          profile?.badgePoints;
      if (Number.isFinite(Number(v))) points = Number(v);
    }

    const profileBadges = normalizeBadges(profile?.badges);
    let normalizedBadges = [];
    if (badgesRes.status === 'fulfilled') {
      const list =
          Array.isArray(badgesRes.value)
              ? badgesRes.value
              : Array.isArray(badgesRes.value?.badges)
                  ? badgesRes.value.badges
                  : Array.isArray(badgesRes.value?.data?.badges)
                      ? badgesRes.value.data.badges
                      : [];
      normalizedBadges = normalizeBadges(list);
    }

    const mergedBadges = mergeOwnedBadges(profileBadges, normalizedBadges, fallbackBadges);
    const badges = mergedBadges.length ? mergedBadges : fallbackBadges;

    setSummary({
      nickname,
      currentTitle: title,
      points_total: points,
      badges,
      profileImage: avatar,
    });
  }, [fallbackAvatar, fallbackBadges, fallbackNickname, fallbackPoints, fallbackTitle]);

  useEffect(() => {
    if (auth?.loading) return;
    loadSummary();
  }, [auth?.accessToken, auth?.loading, loadSummary]);

  useFocusEffect(
      useCallback(() => {
        loadSummary();
      }, [loadSummary])
  );

  const [logoutLoading, setLogoutLoading] = useState(false);

  const authCtx = useAuth();
  const performLogout = authCtx?.logout ?? (async () => {
    await AsyncStorage.multiRemove([
      'accessToken',
      'refreshToken',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
      'user',
    ]);
  });

  const onPressLogout = async () => {
    if (logoutLoading) return;

    try {
      setLogoutLoading(true);
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('refreshToken'),
      ]);

      if (authApi && typeof authApi.logout === 'function') {
        await authApi.logout({ accessToken, refreshToken });
      }

      await performLogout();
      router.replace('/login');
    } catch (err) {
      Alert.alert('로그아웃 실패', err?.message || '로그아웃에 실패했습니다.');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
      <View style={{ flex: 1 }}>
        {/* 배경 그라데이션 */}
        <LinearGradient
            colors={['#AF46CD', '#E2A9F1', '#fafafaff']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safe}>
          {/* 헤더 카드 (버튼 포함) */}
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              {/* 카드 내부 우측 상단 버튼 */}
              <View style={styles.profileBtnRow}>
                <TouchableOpacity
                    onPress={onPressLogout}
                    style={[styles.profileBtnInside, logoutLoading ? styles.profileBtnDisabled : null]}
                    activeOpacity={0.85}
                    disabled={logoutLoading}
                >
                  <Text style={styles.profileSmallText}>
                    {logoutLoading ? '로그아웃 중...' : '로그아웃'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push('/profile')}
                    style={styles.profileBtnInside}
                    activeOpacity={0.85}
                >
                  <Text style={styles.profileSmallText}>개인정보 수정</Text>
                </TouchableOpacity>
              </View>

              {/* 프로필 요약 */}
              <View style={styles.headerTop}>
                <View style={styles.avatarWrap}>
                  {summary?.profileImage ? (
                      <Image source={{ uri: summary.profileImage }} style={styles.avatar} />
                  ) : (
                      <Image source={require('../image/img/User.png')} style={styles.avatar} />
                  )}
                </View>

                <View style={{ flex: 1, paddingRight: 92 }}>
                  <Text style={styles.nickname} numberOfLines={1}>{summary.nickname}</Text>
                  <Text style={styles.title} numberOfLines={1}>{summary.currentTitle}</Text>

                  {/* 포인트 버튼: 배지 상점으로 이동 */}
                  <TouchableOpacity
                      onPress={() =>
                          router.push({ pathname: '/badgeShop', params: { points: String(summary.points_total) } })
                      }
                      style={styles.pointsBtn}
                      activeOpacity={0.85}
                      accessibilityLabel="보유 포인트, 배지 상점으로 이동"
                  >
                    <Text style={styles.pointsCoin}>●</Text>
                    <Text style={styles.pointsText}>{summary.points_total.toLocaleString()} P</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 배지 */}
              <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                  style={{ marginTop: 6 }}
              >
                {summary.badges?.length ? (
                    summary.badges.map((b) => (
                        <View key={b.id} style={styles.badgeChip}>
                          <Text style={styles.badgeText}>{b.emoji} {b.name}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.badgeEmpty}>획득한 배지가 아직 없어요</Text>
                )}
              </ScrollView>
            </View>
          </View>

          {/* 중앙 콘텐츠 */}
          <View style={styles.container}>
            <Image
                source={require('../image/img/scsc1.png')}
                style={{ width: 300, height: 300, marginBottom: -80 }}
                resizeMode="contain"
            />
            <Text style={styles.subtitle}>안녕 나는 토리야! 만나서 반가워</Text>
            <Text style={styles.titleMain}>성큼성큼</Text>

            <View style={styles.buttons}>
              <TouchableOpacity
                  style={[styles.btn, styles.primary]}
                  onPress={() => router.push('/chat')}
                  activeOpacity={0.8}
              >
                <Text style={[styles.btnText, { color: '#ffffff' }]}>챗봇과 상담하기</Text>
                <Text style={styles.btnSub}>RAG 기반 Q&A</Text>
              </TouchableOpacity>

              <TouchableOpacity
                  style={[styles.btn, styles.secondary]}
                  onPress={() => router.push('/scenarioSelect')}
                  activeOpacity={0.8}
              >
                <Text style={styles.btnText}>시나리오</Text>
                <Text style={styles.btnSub}>상황형 퀴즈로 학습</Text>
              </TouchableOpacity>

              <TouchableOpacity
                  style={[styles.btn, styles.secondary]}
                  onPress={() => router.push('/board')}
                  activeOpacity={0.8}
              >
                <Text style={styles.btnText}>게시판</Text>
                <Text style={styles.btnSub}>익명으로 소통하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerInfo: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileBtnRow: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtnInside: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileBtnDisabled: { opacity: 0.6 },
  profileSmallText: { fontSize: 12, color: '#374151', fontFamily: 'PretendardMedium' },

  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eef2ff',
  },
  avatar: { width: 40, height: 40, resizeMode: 'cover' },

  nickname: { fontFamily: 'PretendardBold', fontSize: 16, color: '#111827', marginTop: 2 },
  title: { fontFamily: 'PretendardMedium', fontSize: 12, color: '#4b5563', marginTop: 2 },

  /* 기존 pointsPill → 버튼 스타일로 변경 */
  pointsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#111827',
    gap: 6,
  },
  pointsCoin: { fontSize: 10, color: '#FFD54A' },
  pointsText: { fontFamily: 'PretendardBold', fontSize: 13, color: '#ffffff' },

  badgeChip: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'PretendardMedium', fontSize: 11, color: '#374151' },
  badgeEmpty: { fontFamily: 'PretendardMedium', fontSize: 11, color: '#9ca3af' },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  titleMain: { fontSize: 36, fontWeight: '800', letterSpacing: 1, fontFamily: 'PretendardBold' },
  subtitle: { fontSize: 14, color: '#374151', fontFamily: 'PretendardMedium' },

  buttons: { marginTop: 24, width: '100%', gap: 14 },
  btn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#e5e7eb' },
  btnText: { fontSize: 18, color: '#111827', fontFamily: 'PretendardBold' },
  btnSub: { marginTop: 4, fontSize: 12, color: '#6b7280', fontFamily: 'PretendardMedium' },
});