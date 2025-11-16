// lib/apiClient.js
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTokensExternally } from './auth-context';

const API = process.env.EXPO_PUBLIC_API || 'https://api.seongkeum.com';

/* -------------------- 공통 -------------------- */
const toURL = (path) => {
  if (!path) return API;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API}${path.startsWith('/') ? '' : '/'}${path}`;
};

const authHeaders = async () => {
  const t = await AsyncStorage.getItem('accessToken');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const norm = (opt = {}) => {
  const headers = { ...(opt.headers || {}) };
  const body =
      opt.body == null ? undefined : typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body);
  return { ...opt, headers, body };
};

/* -------------------- JSON 호출 (401→refresh 1회) -------------------- */
export async function fetchJSON(path, options = {}) {
  const url = toURL(path);
  const first = norm(options);

  const hasBody = first.body != null;
  first.headers = {
    ...(await authHeaders()),
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(first.headers || {}),
  };

  let res = await fetch(url, first);
  let json = null;
  try { json = await res.json(); } catch {}

  if (res.status === 401) {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) {
        const r = await fetch(toURL('/api/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const jr = await r.json().catch(() => ({}));
        const newAccess = jr?.data?.accessToken || jr?.accessToken;
        const newRefresh = jr?.data?.refreshToken || jr?.refreshToken;
        const accessTokenExpiresAt = jr?.data?.accessTokenExpiresAt || jr?.accessTokenExpiresAt;
        const refreshTokenExpiresAt = jr?.data?.refreshTokenExpiresAt || jr?.refreshTokenExpiresAt;
        if (r.ok && newAccess) {
          await setTokensExternally({
            accessToken: newAccess,
            ...(newRefresh !== undefined ? { refreshToken: newRefresh } : {}),
            ...(accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt } : {}),
            ...(refreshTokenExpiresAt !== undefined ? { refreshTokenExpiresAt } : {}),
          });
          const retry = norm(options);
          const retryHasBody = retry.body != null;
          retry.headers = {
            ...(await authHeaders()),
            Accept: 'application/json',
            ...(retryHasBody ? { 'Content-Type': 'application/json' } : {}),
            ...(retry.headers || {}),
          };
          res = await fetch(url, retry);
          json = await res.json().catch(() => null);
        }
      }
    } catch {
      await setTokensExternally({
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
      });
    }
  }

  if (!res.ok || json?.status === 'error') {
    const msg = json?.message || `요청 실패 (HTTP ${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.response = json;
    err.url = url;
    throw err;
  }
  return (json && (json.data ?? json)) ?? {};
}

/* -------------------- 시스템 -------------------- */
export const systemApi = {
  health: () => fetchJSON('/api/healthz', { method: 'GET' }),
};

/* -------------------- 메일 -------------------- */
export const mailApi = {
  testSend: ({ to, subject, text }) =>
      fetchJSON('/api/mail/test', { method: 'POST', body: { to, subject, text } }),
};

/* -------------------- 인증 -------------------- */
export const authApi = {
  register: (data) => fetchJSON('/api/auth/register', { method: 'POST', body: data }),
  checkNickname: (nickname) =>
      fetchJSON(`/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`),
  login: ({ email, password }) =>
      fetchJSON('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: ({ accessToken, refreshToken } = {}) =>
      fetchJSON('/api/auth/logout', {
        method: 'POST',
        body: {
          ...(accessToken ? { accessToken } : {}),
          ...(refreshToken ? { refreshToken } : {}),
        },
      }),
  changePassword: ({ currentPassword, newPassword, newPasswordConfirm }) =>
      fetchJSON('/api/users/me/change-password', {
        method: 'PATCH',
        body: {
          ...(currentPassword ? { currentPassword } : {}),
          newPassword,
          newPasswordConfirm,
        },
      }),
  findEmail: ({ nickname, gender, birthYear }) =>
      fetchJSON('/api/auth/find-email', {
        method: 'POST',
        body: {
          nickname,
          gender,
          birthYear,
          birthyear: birthYear, // 백엔드 구현에 따라 대소문자 혼용 대비
        },
      }),
  requestTemporaryPassword: ({ email }) =>
      fetchJSON('/api/auth/find-password', { method: 'POST', body: { email } }),
  refresh: (refreshToken) =>
      fetchJSON('/api/auth/refresh', { method: 'POST', body: { refreshToken } }),
};

/* -------------------- 사용자 -------------------- */
export const userApi = {
  me: () => fetchJSON('/api/users/me'),
  update: (data) => fetchJSON('/api/users/me', { method: 'PATCH', body: data }),
  remove: () => fetchJSON('/api/users/me', { method: 'DELETE' }),
  get: () => fetchJSON('/api/users/me', {method: 'GET'}),
  changePW: (data) => fetchJSON('/api/users/me/change-password', { method: 'PATCH', body: data })
};

/* -------------------- 포인트/배지 -------------------- */
export const pointsApi = {
  me: () => fetchJSON('/api/points/me'),
  histories: ({ limit, cursor } = {}) => {
    const params = new URLSearchParams();
    if (limit != null) params.set('limit', limit);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return fetchJSON(`/api/points/me/history${qs ? `?${qs}` : ''}`);
  },
};

export const badgeApi = {
  list: ({ limit, cursor } = {}) => {
    const params = new URLSearchParams();
    if (limit != null) params.set('limit', limit);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return fetchJSON(`/api/badges${qs ? `?${qs}` : ''}`);
  },
  purchase: (badgeId) =>
      fetchJSON('/api/badges/purchase', { method: 'POST', body: { id: badgeId } }),
};

/* -------------------- 게시판/댓글 -------------------- */
export const boardApi = {
  getPosts: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return fetchJSON(`/api/board/posts${query ? `?${query}` : ''}`);
  },
  createPost: (data) => fetchJSON('/api/board/posts', { method: 'POST', body: data }),
  getPostById: (postId) => fetchJSON(`/api/board/posts/${postId}`),
  updatePost: (postId, data) =>
      fetchJSON(`/api/board/posts/${postId}`, { method: 'PATCH', body: data }),
  deletePost: (postId) => fetchJSON(`/api/board/posts/${postId}`, { method: 'DELETE' }),
  likeOn: (postId, body = {}) =>
      fetchJSON(`/api/board/posts/${postId}/like`, {
        method: 'POST',
        body: { liked: true, ...body },
      }),
  likeOff: (postId) => fetchJSON(`/api/board/posts/${postId}/like`, { method: 'DELETE' }),
};

export const commentApi = {
  create: (postId, data) =>
      fetchJSON(`/api/board/posts/${postId}/comments`, { method: 'POST', body: data }),
  update: (postId, commentId, data) =>
      fetchJSON(`/api/board/posts/${postId}/comments/${commentId}`, { method: 'PATCH', body: data }),
  delete: (postId, commentId) =>
      fetchJSON(`/api/board/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
};

/* -------------------- AI -------------------- */
export const aiApi = {
  chat: ({ query, topk = 8, friendStyle = true } = {}) =>
      fetchJSON('/api/ai/chat', {
        method: 'POST',
        body: {
          query,
          ...(topk != null ? { topk } : {}),
          ...(friendStyle != null ? { friendStyle } : {}),
        },
      }),

  stream: async ({ query, topk = 8, friendStyle = true, onMessage, onDone, signal }) => {
    const payload = {
      query,
      ...(topk != null ? { topk } : {}),
      ...(friendStyle != null ? { friendStyle } : {}),
    };

    const res = await fetch(toURL('/api/ai/chat/stream'), {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => null);
      const msg = errText?.trim() || `요청 실패 (HTTP ${res.status})`;
      throw new Error(msg);
    }

    try {
      await consumeSseResponse(res, { signal, onMessage });
      if (!signal?.aborted) onDone?.();
    } catch (err) {
      if (signal?.aborted) return;
      throw err;
    }
  },
};

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

const decodeChunk = (value, { stream = false } = {}) => {
  if (value == null) {
    if (decoder && !stream) return decoder.decode();
    return '';
  }
  if (typeof value === 'string') return value;
  if (decoder) return decoder.decode(value, { stream });
  let out = '';
  for (let i = 0; i < value.length; i += 1) out += String.fromCharCode(value[i]);
  return out;
};

const emitPayload = (payload, onMessage) => {
  if (!payload) return;
  try {
    const data = JSON.parse(payload);
    const delta =
        typeof data?.delta === 'string'
            ? data.delta
            : typeof data?.message === 'string'
                ? data.message
                : typeof data?.content === 'string'
                    ? data.content
                    : typeof data?.text === 'string'
                        ? data.text
                        : null;
    if (delta) {
      onMessage?.(delta);
      return;
    }
  } catch {}
  onMessage?.(payload);
};

const processSseBuffer = (buffer, onMessage) => {
  let done = false;
  const events = buffer.split(/\n\n/);
  let remainder = events.pop() ?? '';
  for (const event of events) {
    const lines = event.split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') {
        done = true;
        remainder = '';
        break;
      }
      emitPayload(payload, onMessage);
    }
    if (done) break;
  }
  return { done, remainder };
};

const consumeSseResponse = async (res, { onMessage, signal } = {}) => {
  if (signal?.aborted) return;

  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    if (!signal?.aborted) processSseBuffer(text, onMessage);
    return;
  }

  let buffer = '';
  let finished = false;

  while (!finished && !signal?.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decodeChunk(undefined, { stream: false });
      processSseBuffer(buffer, onMessage);
      finished = true;
      break;
    }
    buffer += decodeChunk(value, { stream: true });
    const result = processSseBuffer(buffer, onMessage);
    finished = result.done;
    buffer = result.remainder;
  }

  if (signal?.aborted) {
    try {
      await reader.cancel();
    } catch {}
  }
};

/* -------------------- 퀴즈 (BE) -------------------- */
export const quizApi = {
  getKeywords: () => fetchJSON('/api/quiz/keywords'),
  createSet: ({ keyword, size, count } = {}) => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (size != null) params.set('size', size);
    if (count != null) params.set('count', count);
    const qs = params.toString();
    return fetchJSON(`/api/quiz/generate${qs ? `?${qs}` : ''}`);
  },
  submitAnswer: ({ quizId, questionId, choice, keyword }) =>
      fetchJSON('/api/quiz/answer', { method: 'POST', body: { quizId, questionId, choice, keyword } }),
  getResult: (resultId) => fetchJSON(`/api/quiz/results/${encodeURIComponent(resultId)}`),
};