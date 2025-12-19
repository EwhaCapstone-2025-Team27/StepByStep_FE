# 성큼성큼 - Frontend

해당 리포지토리는 **성큼성큼** 모바일 앱의 프론트엔드(Expo/React Native) 코드입니다.
Expo Router 기반의 파일 라우팅을 사용하며, Android 환경에서 실행할 수 있습니다.

---

## 📁 Source Code 설명

프로젝트의 주요 구조는 다음과 같습니다:

```
.
├── app/                 # Expo Router 라우팅(화면) 폴더
├── assets/              # 이미지/폰트 등 정적 리소스
├── components/          # 재사용 UI 컴포넌트
├── constants/           # 상수 정의
├── hooks/               # 커스텀 훅
├── lib/                 # 유틸/헬퍼/공통 로직
├── app.json             # Expo 앱 설정
├── app.config.js        # Expo 동적 설정(필요 시)
├── package.json         # 스크립트/의존성
└── tsconfig.json        # TypeScript 설정
```

---

## 🛠️ How to Build

### 1️⃣ 저장소 클론

```bash
git clone <YOUR_REPO_URL>
cd StepByStep_FE
```

### 2️⃣ 의존성 설치

```bash
npm install
```

> `node_modules`는 저장소에 포함되어 있지 않으며, 위 명령을 통해 설치합니다.

---

## 🚀 How to Run

### 1️⃣ 개발 서버 실행

```bash
npx expo start
```

실행 후 터미널 안내에 따라 다음 중 하나로 실행할 수 있습니다:

- **Expo Go** (QR 코드 스캔)
- **Android Emulator**

### 2️⃣ 플랫폼 실행(선택)

```bash
npm run android
```

---

## ✅ How to Test / Lint

현재 별도의 테스트 스위트는 없으며, 린트 검사만 제공합니다:

```bash
npm run lint
```

---

## ⚙️ 개발 환경

- **Node.js** (권장: LTS 버전)
- **npm**
- **Expo CLI** (필수는 아니며 `npx expo`로 실행 가능)

---

## 📦 주요 라이브러리

`package.json` 기준 주요 의존성은 다음과 같습니다:

- **expo / expo-router**: 앱 실행 및 라우팅
- **react / react-native**: UI 및 네이티브 렌더링
- **@react-navigation/native**: 네비게이션 기반
- **react-native-gesture-handler / reanimated / screens**: 네이티브 제스처/애니메이션
- **expo-image / expo-linear-gradient / expo-splash-screen**: UI/이미지/스플래시 구성

---

## 🔗 참고

- Expo 공식 문서: https://docs.expo.dev/
- Expo Router 문서: https://docs.expo.dev/router/introduction/
