// app/badgeShop.js
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { badgeApi, pointsApi } from '../lib/apiClient';

const BADGE_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 20;

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
};

const normalizeBadgeList = (list) => {
  if (!Array.isArray(list)) return [];
  return list
      .filter(Boolean)
      .map((badge, idx) => {
        const numericPrice = Number(badge?.price ?? badge?.cost ?? badge?.point ?? 0);
        return {
          id: badge?.id ?? badge?.badgeId ?? badge?.code ?? `badge-${idx}`,
          name: badge?.name ?? badge?.badgeName ?? badge?.title ?? '배지',
          emoji: badge?.emoji ?? badge?.icon ?? badge?.symbol ?? '🏅',
          description: badge?.description ?? badge?.detail ?? badge?.summary ?? '',
          price: Number.isFinite(numericPrice) ? numericPrice : 0,
          owned: Boolean(
              badge?.owned ??
              badge?.isOwned ??
              badge?.hasBadge ??
              badge?.userHasBadge ??
              badge?.alreadyPurchased ??
              false
          ),
        };
      });
};

const normalizeHistories = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).map((item, idx) => ({
    id: item?.id ?? item?.historyId ?? item?.logId ?? `history-${idx}`,
    type: item?.type === 'EARN' ? 'EARN' : item?.type === 'SPEND' ? 'SPEND' : (item?.pointChange ?? 0) >= 0 ? 'EARN' : 'SPEND',
    title: item?.title ?? item?.reason ?? item?.description ?? '포인트 내역',
    pointChange: Number(item?.pointChange ?? item?.points ?? item?.point ?? 0),
    balanceAfter: Number(item?.balanceAfter ?? item?.balance ?? item?.remain ?? 0),
    createdAt: item?.createdAt ?? item?.created_at ?? item?.timestamp ?? null,
  }));
};

const toPointString = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : '0';
};

const toChangeString = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toLocaleString()} P`;
};

export default function BadgeShopScreen() {
  const params = useLocalSearchParams();
  const initialPointParam = params?.points;
  const [myPoints, setMyPoints] = useState(() => {
    const parsed = Number(initialPointParam);
    return Number.isFinite(parsed) ? parsed : 0;
  });

  const [pointsLoading, setPointsLoading] = useState(false);

  const [badges, setBadges] = useState([]);
  const [badgeHasNext, setBadgeHasNext] = useState(false);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgesLoadingMore, setBadgesLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [histories, setHistories] = useState([]);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyHasNext, setHistoryHasNext] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyMeta, setHistoryMeta] = useState({ nickname: '', currentPoints: null, updatedAt: null });

  const badgeCursorRef = useRef(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim]);

  useEffect(() => {
    if (initialPointParam == null) return;
    const parsed = Number(initialPointParam);
    if (Number.isFinite(parsed)) setMyPoints(parsed);
  }, [initialPointParam]);

  const loadPoints = useCallback(async () => {
    try {
      setPointsLoading(true);
      const res = await pointsApi.me();
      const numericCandidate =
          res?.myPoint ?? res?.points ?? res?.point ?? res?.balance ?? res?.currentPoints;
      const numeric = Number(numericCandidate);
      const hasNumeric = Number.isFinite(numeric);
      if (hasNumeric) {
        setMyPoints(numeric);
      }
      setHistoryMeta((prev) => ({
        nickname: res?.nickname ?? prev.nickname ?? '',
        currentPoints: hasNumeric ? numeric : prev.currentPoints,
        updatedAt: res?.updatedAt ?? prev.updatedAt ?? null,
      }));
    } catch (err) {
      if (err?.status === 401) return;
      Alert.alert('포인트 조회 실패', err?.message || '내 포인트 정보를 불러오지 못했어요.');
    } finally {
      setPointsLoading(false);
    }
  }, []);

  const badgeLoadingRef = useRef(false);
  const loadBadges = useCallback(async ({ append = false, cursor: cursorOverride } = {}) => {
    if (badgeLoadingRef.current) return;
    badgeLoadingRef.current = true;
    if (append) {
      setBadgesLoadingMore(true);
    } else {
      setBadgesLoading(true);
      badgeCursorRef.current = null;
      setBadgeHasNext(false);
    }
    try {
      const cursorToUse = append ? cursorOverride ?? badgeCursorRef.current ?? undefined : cursorOverride ?? undefined;
      const res = await badgeApi.list({ limit: BADGE_PAGE_SIZE, cursor: cursorToUse });
      const list = normalizeBadgeList(res?.badges ?? res?.data?.badges ?? (Array.isArray(res) ? res : []));
      setBadges((prev) => {
        const base = append ? [...prev] : [];
        const indexMap = new Map(base.map((item, index) => [String(item.id), index]));
        list.forEach((item) => {
          const key = String(item.id);
          if (indexMap.has(key)) {
            const idx = indexMap.get(key);
            base[idx] = { ...base[idx], ...item };
          } else {
            indexMap.set(key, base.length);
            base.push(item);
          }
        });
        return base;
      });
      const nextCursor = res?.paging?.nextCursor ?? res?.data?.paging?.nextCursor ?? null;
      badgeCursorRef.current = nextCursor;
      setBadgeHasNext(Boolean(res?.paging?.hasNext ?? res?.data?.paging?.hasNext));
    } catch (err) {
      if (err?.status !== 401) {
        Alert.alert('배지 불러오기 실패', err?.message || '배지 목록을 불러오지 못했어요.');
      }
    } finally {
      badgeLoadingRef.current = false;
      setBadgesLoading(false);
      setBadgesLoadingMore(false);
    }
  }, []);

  const historyLoadingRef = useRef(false);
  const loadHistories = useCallback(
      async ({ append = false, cursor: cursorOverride } = {}) => {
        if (historyLoadingRef.current) return;
        historyLoadingRef.current = true;
        if (append) {
          setHistoryLoading(true);
        } else {
          setHistoryRefreshing(true);
        }
        try {
          const cursorToUse = append ? (cursorOverride ?? historyCursor) : cursorOverride ?? undefined;
          if (!append) {
            setHistoryCursor(null);
            setHistoryHasNext(false);
          }
          const res = await pointsApi.histories({ limit: HISTORY_PAGE_SIZE, cursor: cursorToUse });
          const list = normalizeHistories(res?.histories ?? res?.data?.histories ?? []);
          setHistories((prev) => {
            const base = append ? [...prev] : [];
            const indexMap = new Map(base.map((item, index) => [String(item.id), index]));
            list.forEach((item) => {
              const key = String(item.id);
              if (indexMap.has(key)) {
                const idx = indexMap.get(key);
                base[idx] = { ...base[idx], ...item };
              } else {
                indexMap.set(key, base.length);
                base.push(item);
              }
            });
            return base;
          });
          setHistoryMeta((prev) => {
            const numeric = Number(
                res?.currentPoints ?? res?.myPoint ?? res?.points ?? res?.balance ?? prev.currentPoints ?? myPoints
            );
            return {
              nickname: res?.nickname ?? prev.nickname ?? '',
              currentPoints: Number.isFinite(numeric) ? numeric : prev.currentPoints ?? myPoints,
              updatedAt: res?.updatedAt ?? prev.updatedAt,
            };
          });
          setHistoryCursor(res?.paging?.nextCursor ?? res?.data?.paging?.nextCursor ?? null);
          setHistoryHasNext(Boolean(res?.paging?.hasNext ?? res?.data?.paging?.hasNext));
        } catch (err) {
          if (err?.status !== 401) {
            Alert.alert('포인트 내역 조회 실패', err?.message || '포인트 내역을 불러오지 못했어요.');
          }
        } finally {
          historyLoadingRef.current = false;
          setHistoryLoading(false);
          setHistoryRefreshing(false);
        }
      },
      [historyCursor, myPoints]
  );

  useEffect(() => {
    loadPoints();
    loadBadges({ append: false });
  }, [loadPoints, loadBadges]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadPoints(), loadBadges({ append: false })]);
    } finally {
      setRefreshing(false);
    }
  }, [loadPoints, loadBadges]);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setSelected(null);
  }, []);

  const openConfirm = (badge) => {
    if (!badge) return;
    if (badge.owned) {
      Alert.alert('이미 보유한 배지', '이미 구매한 배지예요.');
      return;
    }
    setSelected(badge);
    setConfirmOpen(true);
  };

  const onConfirmBuy = useCallback(async () => {
    if (!selected) return;
    const badgeId = selected.id;
    const price = Number(selected.price ?? 0);

    if (selected.owned) {
      setConfirmOpen(false);
      return;
    }
    if (myPoints < price) {
      setConfirmOpen(false);
      Alert.alert('포인트 부족', '포인트가 부족합니다!');
      return;
    }

    setConfirmOpen(false);
    const prevPoints = myPoints;
    setMyPoints((p) => p - price);
    setBadges((prev) =>
        prev.map((item) =>
            String(item.id) === String(badgeId)
                ? { ...item, owned: true }
                : item
        )
    );

    try {
      const res = await badgeApi.purchase(badgeId);
      const badgeInfo = res?.badge ?? res?.data?.badge ?? res;
      const pointsInfo = res?.points ?? res?.data?.points ?? res;

      const afterPoint = Number(pointsInfo?.after ?? pointsInfo?.current ?? pointsInfo?.balance ?? pointsInfo?.point);
      if (Number.isFinite(afterPoint)) {
        setMyPoints(afterPoint);
        setHistoryMeta((prev) => ({
          ...prev,
          currentPoints: afterPoint,
          updatedAt: pointsInfo?.updatedAt ?? res?.updatedAt ?? new Date().toISOString(),
        }));
        pulse();
      } else {
        pulse();
      }

      const purchasedId = badgeInfo?.badgeId ?? badgeInfo?.id ?? badgeId;
      setBadges((prev) =>
          prev.map((item) =>
              String(item.id) === String(purchasedId)
                  ? { ...item, owned: true }
                  : item
          )
      );
      setSelected(null);
    } catch (err) {
      setSelected(null);
      setMyPoints(prevPoints);
      setBadges((prev) =>
          prev.map((item) =>
              String(item.id) === String(badgeId)
                  ? { ...item, owned: false }
                  : item
          )
      );

      if (err?.status === 401) {
        Alert.alert('로그인이 필요해요', '로그인 후 배지를 구매할 수 있어요.', [
          { text: '로그인으로 이동', onPress: () => router.push('/login') },
          { text: '닫기' },
        ]);
        return;
      }
      if (err?.status === 400) {
        Alert.alert('포인트 부족', err?.message || '포인트가 부족합니다!');
        return;
      }
      if (err?.status === 409) {
        Alert.alert('이미 보유한 배지', err?.message || '이미 소유한 배지예요.');
        setBadges((prev) =>
            prev.map((item) =>
                String(item.id) === String(badgeId)
                    ? { ...item, owned: true }
                    : item
            )
        );
        return;
      }
      Alert.alert('구매 실패', err?.message || '배지 구매 중 오류가 발생했어요.');
    }
  }, [selected, myPoints, pulse]);

  const renderBadgeItem = ({ item }) => {
    const has = Boolean(item.owned);
    return (
        <TouchableOpacity
            onPress={() => openConfirm(item)}
            activeOpacity={has ? 1 : 0.88}
            disabled={has}
            style={[styles.card, has && styles.cardOwned]}
        >
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          {has ? (
              <View style={styles.ownedPill}><Text style={styles.ownedText}>보유중</Text></View>
          ) : (
              <View style={styles.pricePill}>
                <Text style={styles.coinDot}>●</Text>
                <Text style={styles.priceText}>{toPointString(item.price)} P</Text>
              </View>
          )}
        </TouchableOpacity>
    );
  };

  const openHistoryModal = () => {
    setHistoryOpen(true);
    if (!histories.length) {
      loadHistories({ append: false });
    }
  };

  const closeHistoryModal = () => {
    setHistoryOpen(false);
  };

  const headerComponent = (
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>배지 상점</Text>
          <TouchableOpacity
              onPress={openHistoryModal}
              style={styles.historyBtn}
              activeOpacity={0.85}
          >
            <Text style={styles.historyBtnText}>내 포인트 내역</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.pointsWrap, { transform: [{ scale: scaleAnim }] }] }>
          <Text style={styles.pointsCoin}>●</Text>
          <Text style={styles.pointsText}>
            {pointsLoading ? '로딩…' : `${toPointString(myPoints)} P`}
          </Text>
        </Animated.View>
      </View>
  );

  const badgeFooter = (
      <View style={{ paddingVertical: 16 }}>
        {badgesLoadingMore && <ActivityIndicator color="#111827" />}
        {!badgeHasNext && !badgesLoadingMore && badges.length > 0 && (
            <Text style={styles.listEndText}>마지막 배지까지 확인했어요</Text>
        )}
      </View>
  );

  const badgeEmpty = (
      <View style={styles.emptyState}>
        {badgesLoading ? (
            <ActivityIndicator color="#111827" />
        ) : (
            <Text style={styles.emptyText}>표시할 배지가 없어요.</Text>
        )}
      </View>
  );

  const historyFooter = (
      <View style={{ paddingVertical: 16 }}>
        {historyLoading && <ActivityIndicator color="#111827" />}
        {!historyHasNext && !historyLoading && histories.length > 0 && (
            <Text style={styles.listEndText}>모든 내역을 확인했어요</Text>
        )}
      </View>
  );

  return (
      <SafeAreaView style={styles.safe}>
        <FlatList
            data={badges}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderBadgeItem}
            numColumns={2}
            ListHeaderComponent={headerComponent}
            stickyHeaderIndices={[0]}
            ListFooterComponent={badges.length ? badgeFooter : null}
            ListEmptyComponent={badgeEmpty}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
            columnWrapperStyle={{ gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReachedThreshold={0.2}
            onEndReached={() => {
              if (!badgeHasNext || badgesLoadingMore || badgeLoadingRef.current) return;
              loadBadges({ append: true });
            }}
        />

        <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>배지 구매</Text>
              <Text style={styles.modalBadgeName}>{selected?.emoji} {selected?.name}</Text>
              {!!selected?.description && (
                  <Text style={styles.modalDescription}>{selected.description}</Text>
              )}
              <View style={[styles.pricePill, { marginTop: 12 }]}>
                <Text style={styles.coinDot}>●</Text>
                <Text style={styles.priceText}>{toPointString(selected?.price ?? 0)} P</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={closeConfirm}>
                  <Text style={styles.modalBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBuy]} onPress={onConfirmBuy}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>구매하기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={historyOpen} animationType="slide" onRequestClose={closeHistoryModal}>
          <SafeAreaView style={styles.historySafe}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>내 포인트 내역</Text>
              <TouchableOpacity onPress={closeHistoryModal} style={styles.historyCloseBtn}>
                <Text style={styles.historyCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.historySummary}>
              <Text style={styles.historyNickname}>{historyMeta.nickname || '사용자'}</Text>
              <Text style={styles.historyPoints}>{toPointString(historyMeta.currentPoints ?? myPoints)} P</Text>
              <Text style={styles.historyUpdatedAt}>
                최근 업데이트: {historyMeta.updatedAt ? formatDateTime(historyMeta.updatedAt) : '-'}
              </Text>
            </View>

            <FlatList
                data={histories}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <View style={styles.historyItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.historyItemDate}>{formatDateTime(item.createdAt)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.historyItemChange, item.type === 'EARN' ? styles.historyEarn : styles.historySpend]}>
                          {toChangeString(item.pointChange)}
                        </Text>
                        <Text style={styles.historyItemBalance}>{toPointString(item.balanceAfter)} P</Text>
                      </View>
                    </View>
                )}
                refreshControl={
                  <RefreshControl
                      refreshing={historyRefreshing}
                      onRefresh={() => loadHistories({ append: false })}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    {historyRefreshing || historyLoading ? (
                        <ActivityIndicator color="#111827" />
                    ) : (
                        <Text style={styles.emptyText}>포인트 내역이 아직 없어요.</Text>
                    )}
                  </View>
                }
                ListFooterComponent={histories.length ? historyFooter : null}
                onEndReachedThreshold={0.2}
                onEndReached={() => {
                  if (!historyHasNext || historyLoadingRef.current || historyLoading) return;
                  loadHistories({ append: true });
                }}
                contentContainerStyle={{ paddingBottom: 24 }}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  headerWrap: {
    backgroundColor: '#fff',
    paddingBottom: 12,
    paddingTop: 12,
    gap: 12,
  },
  headerRow: {
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  historyBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  historyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pointsWrap: {
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 32,
    width: 70,
    borderRadius: 999,
    backgroundColor: '#111827',
    gap: 6,
  },
  pointsCoin: { fontSize: 10, color: '#FFD54A' },
  pointsText: { fontWeight: '800', color: '#ffffff' },
  card: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOwned: { opacity: 0.65 },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontWeight: '700', fontSize: 14, color: '#111827', textAlign: 'center' },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#111827',
    marginTop: 6,
  },
  coinDot: { fontSize: 10, color: '#FFD54A' },
  priceText: { color: '#fff', fontWeight: '700' },
  ownedPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
  },
  ownedText: { color: '#374151', fontWeight: '700' },
  listEndText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#6b7280' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalBadgeName: { marginTop: 6, fontSize: 16, color: '#374151' },
  modalDescription: { color: '#6b7280', marginTop: 8 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  modalCancel: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  modalBuy: { backgroundColor: '#111827' },
  modalBtnText: { fontWeight: '700', color: '#111827' },
  historySafe: { flex: 1, backgroundColor: '#ffffff' },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
  historyCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  historyCloseText: { color: '#111827', fontWeight: '700' },
  historySummary: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyNickname: { fontSize: 16, fontWeight: '700', color: '#111827' },
  historyPoints: { fontSize: 20, fontWeight: '800', color: '#111827' },
  historyUpdatedAt: { fontSize: 12, color: '#6b7280' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 16,
  },
  historyItemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  historyItemDate: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  historyItemChange: { fontSize: 14, fontWeight: '700' },
  historyEarn: { color: '#047857' },
  historySpend: { color: '#dc2626' },
  historyItemBalance: { fontSize: 12, color: '#4b5563', marginTop: 4 },
});