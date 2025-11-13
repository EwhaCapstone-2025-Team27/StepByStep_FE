// lib/pointsUtils.js
export const formatDateTime = (value) => {
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

export const normalizePointHistories = (list) => {
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean).map((item, idx) => ({
        id: item?.id ?? item?.historyId ?? item?.logId ?? `history-${idx}`,
        type:
            item?.type === 'EARN'
                ? 'EARN'
                : item?.type === 'SPEND'
                    ? 'SPEND'
                    : (item?.pointChange ?? 0) >= 0
                        ? 'EARN'
                        : 'SPEND',
        title: item?.title ?? item?.reason ?? item?.description ?? '포인트 내역',
        pointChange: Number(item?.pointChange ?? item?.points ?? item?.point ?? 0),
        balanceAfter: Number(item?.balanceAfter ?? item?.balance ?? item?.remain ?? 0),
        createdAt: item?.createdAt ?? item?.created_at ?? item?.timestamp ?? null,
    }));
};

export const toPointString = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString() : '0';
};

export const toChangeString = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toLocaleString()} P`;
};