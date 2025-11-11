export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 10;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 20;
export const BIRTH_YEAR_MIN = 1900;

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeGenderValue = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'm' || lower === 'male') return 'M';
    if (lower === 'f' || lower === 'female') return 'F';
    if (lower === '남' || lower === '남자') return 'M';
    if (lower === '여' || lower === '여자') return 'F';
    return null;
};

export const normalizeGenderForApi = (value) => normalizeGenderValue(value);

export const normalizeGenderForState = (value) => {
    const norm = normalizeGenderValue(value);
    if (norm === 'M') return 'male';
    if (norm === 'F') return 'female';
    return null;
};

export const validateNickname = (value) => {
    const str = typeof value === 'string' ? value.trim() : '';
    if (!str) return '닉네임을 입력하세요.';
    if (str.length < NICKNAME_MIN_LENGTH || str.length > NICKNAME_MAX_LENGTH) {
        return `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자여야 합니다.`;
    }
    if (!NICKNAME_REGEX.test(str)) {
        return '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.';
    }
    return null;
};

export const validateEmail = (value) => {
    const str = typeof value === 'string' ? value.trim() : '';
    if (!str) return '이메일을 입력하세요.';
    if (!EMAIL_REGEX.test(str)) return '이메일 형식이 올바르지 않습니다.';
    return null;
};

export const validatePassword = (value, { label = '비밀번호' } = {}) => {
    const str = typeof value === 'string' ? value : '';
    if (!str.trim()) return `${label}를 입력하세요.`;
    if (str.length < PASSWORD_MIN_LENGTH || str.length > PASSWORD_MAX_LENGTH) {
        return `${label}는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자여야 합니다.`;
    }
    return null;
};

export const validateBirthYear = (value) => {
    const str = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!str) return '출생년도를 입력하세요.';
    if (!/^\d{4}$/.test(str)) return '출생년도는 4자리 숫자여야 합니다.';
    const year = Number(str);
    const current = new Date().getFullYear();
    if (year < BIRTH_YEAR_MIN || year > current) {
        return `출생년도는 ${BIRTH_YEAR_MIN}~${current} 사이여야 합니다.`;
    }
    return null;
};

export const validateGender = (value) => {
    const norm = normalizeGenderValue(value);
    if (!norm) return '성별을 선택하세요.';
    return null;
};

export const sanitizeBirthYearInput = (value) => (value ?? '').replace(/[^0-9]/g, '').slice(0, 4);