// lib/apiClient.js
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTokensExternally } from './auth-context';

const API = process.env.EXPO_PUBLIC_API || 'https://api.seongkeum.com';
// 데모 토글: EXPO_PUBLIC_USE_DEMO=true 로 설정했을 때만 프론트 데모 모드로 동작
const DEMO = String(process.env.EXPO_PUBLIC_USE_DEMO).toLowerCase() === 'true';

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
  if (DEMO && path === '/api/healthz') return { status: 'ok' }; // 데모 health

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

/* -------------------- AI 스트리밍 -------------------- */
const DEMO_QA = [
  {
    q: '생리 주기는 보통 얼마정도야?',
    a:
      '생리 주기는 보통 21~35일 사이야. 사람마다 달라서 더 짧거나 길 수도 있어.\n' +
      '배란은 생리 시작 후 12~14일쯤 일어나서 그때 임신 가능성이 가장 높아.\n' +
      '주기가 많이 불규칙하거나 통증이 심하면 보건소나 병원에 상담 받아보는 게 좋아.'
  },
  {
    q: '콘돔은 어떻게 사용해?',
    a:
      '① 포장 가장자리로 조심히 뜯고, 끝 공기를 살짝 눌러 빼.\n' +
      '② 귀두에 대고 바깥으로 말린 방향 확인한 뒤, 뿌리까지 한 번에 굴려 내려.\n' +
      '③ 관계 후 바로 잡고 빼서 입구 묶어 휴지통에 버리면 끝!\n' +
      '윤활제는 물/실리콘 베이스가 좋아. 사이즈가 맞아야 미끄러짐·파손을 줄일 수 있어.'
  }
];

function findDemoAnswer(query) {
  const t = (query || '').trim();
  const hit =
    DEMO_QA.find(({ q }) => t.includes(q) || q.includes(t)) ||
    DEMO_QA.find(({ q }) => t.replace(/\s/g, '') === q.replace(/\s/g, ''));
  if (hit) return hit.a;
  // 안내 문구 (데모 질문 선택 유도)
  return (
    '지금은 프로토타입 모드야 😊\n' +
    '아래 질문 중 하나를 입력해줘!\n' +
    '• 생리 주기는 보통 얼마정도야?\n' +
    '• 콘돔은 어떻게 사용해?'
  );
}

export const aiApi = {
  stream: async ({ query, topk, friendStyle, onMessage, onDone, signal }) => {
    if (DEMO) {
      await sleep(3000, signal);
      if (signal?.aborted) return onDone?.();
      // ⚡ 프로토타입 스트리밍 (프론트에서 토큰 흘리기)
      const text = findDemoAnswer(query);
      const tokens = text.split(/(\s+)/); // 공백 포함으로 자연스러움
      let i = 0;
      const tick = () => {
        if (signal?.aborted) return onDone?.();
        if (i >= tokens.length) return onDone?.();
        onMessage?.(tokens[i++]);
        setTimeout(tick, 15); // 토큰 속도 조절
      };
      tick();
      return;
    }

  },

  generateQuiz: async ({ keywords = [], perKeyword = 2, seed = Date.now() & 0xffff } = {}) => {
    if (DEMO) {
      const useKws = (keywords.length ? keywords : DEMO_KEYWORDS).slice(0, 5);
      const sets = useKws.map((kw) => {
        const bank = DEMO_QUIZ_BANK[kw] || [];
        const qs = seededShuffle(bank, seed).slice(0, perKeyword);
        return { keyword: kw, questions: qs };
      });
      return { sets };
    }
    // 실서버 연동 버전(원하면 교체): /api/quiz?keyword=... 형태 등
    // return await fetchJSON(`/api/quiz?...`);

    // --- 실제 BE 스트리밍 (DEMO=false일 때만) ---
    const res = await fetch(`${process.env.EXPO_PUBLIC_API}/api/chat/stream`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, topk, friendStyle }),
      signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.split(/\n\n/);
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') break;
        try {
          const data = JSON.parse(payload);
          if (data.delta) onMessage?.(data.delta);
        } catch {}
      }
    }
    onDone?.();
  },
};
// ----- small util -----
const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => { clearTimeout(t); resolve(); };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });

/* -------------------- 데모용 시나리오 뱅크 -------------------- */
const DEMO_KEYWORDS = ['피임', '생리', '연애', '신체 변화', '젠더'];

const DEMO_QUIZ_BANK = {
  '피임': [
    {
      prompt: '응급피임약은 언제, 어떻게 쓰는 게 맞을까?',
      options: [
        '관계 72시간 이내에 복용한다',
        '관계 1주일 뒤 아무 때나 복용한다',
        '임신 테스트기 양성일 때만 복용한다',
        '생리 예정일에 맞춰 복용한다',
      ],
      correctIndex: 0,
      explain: '응급피임약은 빠를수록 효과가 좋아요(72시간 이내 권장). 처방/복용 안내는 의료진과 상의하세요.',
    },
    {
      prompt: '콘돔을 사용할 때 가장 먼저 확인할 것은?',
      options: [
        '라텍스/논라텍스 재질',
        '유통기한과 포장 손상 여부',
        '색상/향',
        '윤활제의 점도',
      ],
      correctIndex: 1,
      explain: '유통기한/포장 손상은 파손 위험과 직결됩니다. 손상/기한지남은 사용하지 않는 게 안전해요.',
    },
  ],
  '생리': [
    {
      prompt: '배란 시기와 임신 가능성에 대한 설명으로 옳은 것은?',
      options: [
        '배란은 생리 시작 직후 발생한다',
        '배란 무관하게 매일 임신 가능성이 동일하다',
        '보통 생리 시작 후 12~14일에 배란이 일어나 임신 가능성이 높다',
        '배란은 통증이 심할 때만 일어난다',
      ],
      correctIndex: 2,
      explain: '개인차는 있지만, 생리 시작 후 12~14일 무렵 배란이 일어나 임신 가능성이 상대적으로 높아요.',
    },
    {
      prompt: '생리 대화가 불편한 친구에게 어떻게 배려하는 게 좋을까?',
      options: [
        '장난스럽게 넘긴다',
        '불편하면 억지로 말하게 한다',
        '상대의 감정을 존중하고 필요시 쉬게 한다',
        '전혀 언급하지 않는다',
      ],
      correctIndex: 2,
      explain: '민감할 수 있어요. 감정을 존중하고 쉬는 선택지를 주는 배려가 좋아요.',
    },
  ],
  '연애': [
    {
      prompt: '상대가 스킨십을 원하지만 나는 준비가 안 됐다. 가장 건강한 대응은?',
      options: [
        '침묵한다',
        '"난 아직 준비되지 않았어. 천천히 가고 싶어."라고 분명히 말한다',
        '억지로 따라간다',
        '자리를 피한다(도망간다)',
      ],
      correctIndex: 1,
      explain: '동의(Consent)는 명확하고 자발적이며 언제든 취소 가능해요. 경계를 분명히 전달하세요.',
    },
    {
      prompt: '연인이 휴대폰 비밀번호 공유를 요구한다. 어떻게 할까?',
      options: [
        '연인이니까 무조건 공유한다',
        '거절하면 사랑하지 않는 거다',
        '개인정보/안전 문제로 정중히 거절할 수 있다',
        '몰래 알려준다',
      ],
      correctIndex: 2,
      explain: '비밀번호 공유 강요는 건강한 관계가 아니에요. 개인 정보는 스스로 지킬 권리가 있어요.',
    },
  ],
  '신체 변화': [
    {
      prompt: '사춘기 신체 변화가 불안할 때, 가장 좋은 방법은?',
      options: [
        '검색만 계속한다',
        '믿을 만한 어른/보건교사/의료진에게 상담한다',
        '비슷한 또래에게만 묻는다',
        '혼자 참는다',
      ],
      correctIndex: 1,
      explain: '검증된 정보와 전문가 상담이 도움이 돼요. 불안할 땐 혼자 견디지 않아도 됩니다.',
    },
    {
      prompt: '여드름이 많이 날 때 즉시 할 행동으로 적절한 것은?',
      options: [
        '손으로 계속 짠다',
        '세안/보습 루틴을 점검하고 필요시 병원 상담한다',
        '뜨거운 수건으로 오래 지진다',
        '화장으로 완전히 가린다',
      ],
      correctIndex: 1,
      explain: '과도한 자극은 악화 요인이 될 수 있어요. 기본 루틴을 점검하고 필요시 전문 진료를 권장합니다.',
    },
  ],
  '젠더': [
    {
      prompt: '친구가 자신을 특정 성정체성으로 소개했다. 나의 태도로 가장 적절한 것은?',
      options: [
        '장난으로 별명 붙이기',
        '무시하기',
        '자기호칭/호칭을 존중하고 경청하기',
        '강제로 바꾸라고 설득',
      ],
      correctIndex: 2,
      explain: '상대가 원하는 호칭/정체성을 존중하고 경청하는 태도가 기본 매너예요.',
    },
    {
      prompt: '성 고정관념을 줄이는 실천으로 옳은 것은?',
      options: [
        '옷/취미/직업을 성별로 구분해서 평가하기',
        '누구나 다양한 선택을 할 수 있음을 인정하기',
        '스테레오타입 농담을 늘 하기',
        '성별에 따른 역할을 강요하기',
      ],
      correctIndex: 1,
      explain: '고정관념을 줄이려면 개인의 다양성을 인정하고 존중하는 태도가 필요해요.',
    },
  ],
};

/* 유틸: 시드 기반 섞기 */
function seededShuffle(arr, seed = 1234) {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/* -------------------- 퀴즈 (BE) -------------------- */
export const quizApi = {
  getKeywords: () => fetchJSON('/api/quiz/keywords'),
  createSet: ({ keyword } = {}) =>
    fetchJSON(`/api/quiz${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  submitAnswer: ({ quizId, questionId, choice, keyword }) =>
    fetchJSON('/api/quiz/answer', { method: 'POST', body: { quizId, questionId, choice, keyword } }),
  getResult: (resultId) => fetchJSON(`/api/quiz/results/${encodeURIComponent(resultId)}`),
};