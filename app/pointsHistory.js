// app/pointsHistory.js
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { pointsApi } from '../lib/apiClient';
import {
    formatDateTime,
    normalizePointHistories,
    toChangeString,
    toPointString,
} from '../lib/pointsUtils';

const HISTORY_PAGE_SIZE = 20;

const getParamString = (value) => {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
};

export default function PointsHistoryScreen() {
    const params = useLocalSearchParams();
    const initialNickname = useMemo(() => getParamString(params?.nickname), [params?.nickname]);
    const initialPoints = useMemo(() => {
        const raw = getParamString(params?.points);
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }, [params?.points]);
    const initialUpdatedAt = useMemo(() => {
        const raw = getParamString(params?.updatedAt);
        return raw || null;
    }, [params?.updatedAt]);

    const [summary, setSummary] = useState({
        nickname: initialNickname,
        currentPoints: initialPoints,
        updatedAt: initialUpdatedAt,
    });
    const [histories, setHistories] = useState([]);
    const [hasNext, setHasNext] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const cursorRef = useRef(null);
    const loadingRef = useRef(false);

    const loadHistories = useCallback(
        async ({ append = false, cursor: cursorOverride, refresh = false } = {}) => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            if (append) {
                setLoadingMore(true);
            } else if (refresh) {
                setRefreshing(true);
            } else {
                setLoadingInitial(true);
            }
            try {
                const cursorToUse = append ? cursorOverride ?? cursorRef.current ?? undefined : cursorOverride ?? undefined;
                if (!append) {
                    cursorRef.current = null;
                    setHasNext(false);
                }
                const res = await pointsApi.histories({ limit: HISTORY_PAGE_SIZE, cursor: cursorToUse });
                const list = normalizePointHistories(res?.histories ?? res?.data?.histories ?? []);
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
                setSummary((prev) => {
                    const numeric = Number(
                        res?.currentPoints ?? res?.myPoint ?? res?.points ?? res?.balance ?? prev.currentPoints ?? initialPoints
                    );
                    return {
                        nickname: res?.nickname ?? prev.nickname ?? initialNickname ?? '',
                        currentPoints: Number.isFinite(numeric) ? numeric : prev.currentPoints ?? initialPoints,
                        updatedAt: res?.updatedAt ?? prev.updatedAt ?? initialUpdatedAt,
                    };
                });
                const nextCursor = res?.paging?.nextCursor ?? res?.data?.paging?.nextCursor ?? null;
                cursorRef.current = nextCursor;
                setHasNext(Boolean(res?.paging?.hasNext ?? res?.data?.paging?.hasNext));
            } catch (err) {
                if (err?.status !== 401) {
                    Alert.alert('포인트 내역 조회 실패', err?.message || '포인트 내역을 불러오지 못했어요.');
                }
            } finally {
                loadingRef.current = false;
                if (append) {
                    setLoadingMore(false);
                } else if (refresh) {
                    setRefreshing(false);
                } else {
                    setLoadingInitial(false);
                }
            }
        },
        [initialNickname, initialPoints, initialUpdatedAt]
    );

    useEffect(() => {
        loadHistories({ append: false });
    }, [loadHistories]);

    const onRefresh = useCallback(() => {
        loadHistories({ append: false, refresh: true });
    }, [loadHistories]);

    const listFooter = (
        <View style={styles.footer}>
            {loadingMore && <ActivityIndicator color="#111827" />}
            {!loadingMore && !hasNext && histories.length > 0 && (
                <Text style={styles.footerText}>모든 내역을 확인했어요</Text>
            )}
        </View>
    );

    const summaryComponent = (
        <View style={styles.summaryWrap}>
            <Text style={styles.summaryLabel}>내 포인트</Text>
            <Text style={styles.summaryPoints}>{toPointString(summary.currentPoints ?? 0)} P</Text>
            <Text style={styles.summaryNickname}>{summary.nickname || '사용자'}</Text>
            <Text style={styles.summaryUpdatedAt}>
                최근 업데이트: {summary.updatedAt ? formatDateTime(summary.updatedAt) : '-'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.85}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>내 포인트 내역</Text>
            </View>

            <FlatList
                data={histories}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <View style={styles.historyItem}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitleText} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.historyDate}>{formatDateTime(item.createdAt)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.historyChange, item.type === 'EARN' ? styles.earn : styles.spend]}>
                                {toChangeString(item.pointChange)}
                            </Text>
                            <Text style={styles.historyBalance}>{toPointString(item.balanceAfter)} P</Text>
                        </View>
                    </View>
                )}
                ListHeaderComponent={summaryComponent}
                ListFooterComponent={histories.length ? listFooter : null}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        {loadingInitial || refreshing ? (
                            <ActivityIndicator color="#111827" />
                        ) : (
                            <Text style={styles.emptyText}>포인트 내역이 아직 없어요.</Text>
                        )}
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 24 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                onEndReachedThreshold={0.2}
                onEndReached={() => {
                    if (!hasNext || loadingRef.current || loadingMore) return;
                    loadHistories({ append: true });
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#ffffff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        gap: 12,
    },
    backBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    backText: { fontSize: 16, fontWeight: '700', color: '#111827' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
    summaryWrap: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 6,
        backgroundColor: '#ffffff',
    },
    summaryLabel: { fontSize: 13, color: '#6b7280' },
    summaryPoints: { fontSize: 24, fontWeight: '800', color: '#111827' },
    summaryNickname: { fontSize: 16, fontWeight: '600', color: '#374151' },
    summaryUpdatedAt: { fontSize: 12, color: '#9ca3af' },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    historyTitleText: { fontSize: 14, fontWeight: '600', color: '#111827' },
    historyDate: { fontSize: 12, color: '#6b7280', marginTop: 4 },
    historyChange: { fontSize: 14, fontWeight: '700' },
    earn: { color: '#047857' },
    spend: { color: '#dc2626' },
    historyBalance: { fontSize: 12, color: '#4b5563', marginTop: 4 },
    footer: { paddingVertical: 16 },
    footerText: { textAlign: 'center', color: '#6b7280', fontSize: 12 },
    emptyState: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: '#6b7280' },
});