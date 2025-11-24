# 🛠️ Precourse Badge Workshop (Backend)

> 우아한테크코스 프리코스 참여자들의 GitHub 활동과 커뮤니티 활동을 분석하여, 나만의 [기념 훈장(Badge)]을 발급해주는 카카오톡 챗봇 스킬 서버입니다.

## ✨ 프로젝트 소개 (Overview)

이 백엔드 서버는 **Kakao Chatbot Builder**와 **GitHub API** 사이를 중계하며 다음 역할을 수행합니다.

1. **GitHub Device Flow 인증**: 챗봇 환경에 최적화된 인증 방식 구현
2. **활동 데이터 분석**: 프리코스 기간 내 커밋, PR, 코드 리뷰 정밀 분석
3. **게이미피케이션**: 분석 데이터를 기반으로 등급(Tier) 산정 및 칭호 부여
4. **비동기 처리**: 대용량 GitHub 이벤트 로그 백그라운드 처리

---

## 🏗️ 시스템 아키텍처 (Architecture)

### 🔄 데이터 파이프라인

1. **Auth**: 사용자 인증 (GitHub Device Flow)
2. **Input**: 사용자 정보(기수, 닉네임) 및 히든 질문 수집
3. **Analysis (Background)**: GitHub 이벤트 수집 및 통계 산출 (Async)
4. **Result**: 최종 등급/칭호 계산 및 프론트엔드 뷰어 URL 생성

### 🛠️ 기술 스택 (Tech Stack)

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **External API**: GitHub REST API
- **Deployment**: AWS EC2, Vercel

---

## 📂 디렉토리 구조 (Project Structure)

Bash

```
backend/
├── 📂 routes/         # API 엔드포인트 (Auth, Validation, Workshop)
├── 📂 models/         # MongoDB 스키마 정의 (Participant, Session 등)
├── 📂 services/       # 비즈니스 로직 (GitHub 분석, 인증 처리)
├── 📂 middleware/     # 인증 및 상태 체크 미들웨어
├── 📂 utils/          # 카카오 챗봇 응답 템플릿 빌더
└── 📂 constants/      # 상수, 메시지, 설정 관리`
```

---

## 🔑 주요 API (Key Endpoints)

| **구분**   | **Method** | **경로**                      | **설명**                        |
| ---------- | ---------- | ----------------------------- | ------------------------------- |
| **인증**   | POST       | `/api/auth/start`             | GitHub 인증 시작 및 코드 발급   |
|            | POST       | `/api/auth/check-auth`        | 인증 상태 확인 (Polling)        |
| **검증**   | POST       | `/api/validation/*`           | 기수, 닉네임, 답변 유효성 검사  |
| **워크샵** | POST       | `/api/workshop/setUserInfo`   | 사용자 기본 정보 저장           |
|            | POST       | `/api/workshop/setHiddenInfo` | 히든 답변 저장 및 **분석 시작** |
|            | POST       | `/api/workshop/setReview`     | 회고 저장 및 결과 조회          |
|            | POST       | `/api/workshop/setTitle`      | 칭호 선택 및 뱃지 URL 생성      |

---

## 💾 데이터 모델 (Database Models)

| **모델명**           | **역할**           | **주요 필드**                                              |
| -------------------- | ------------------ | ---------------------------------------------------------- |
| **Participant**      | 사용자 통합 데이터 | `githubId`, `stats`(통계), `results`(등급), `inputs`(답변) |
| **PrecourseSetting** | 기수별 일정 관리   | `classYear`, `weeks`(주차별 기간)                          |
| **AuthSession**      | 임시 인증 세션     | `device_code`, `status` (TTL 15분 자동 삭제)               |

---

## 🚀 설치 및 실행 (Getting Started)

### 1. 환경 변수 설정 (.env)

루트 디렉토리에 `.env` 파일을 생성하세요.

코드 스니펫

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/badge-workshop
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_ADMIN_TOKEN=your_personal_access_token
BASE_URL=https://your-frontend-url.com
```

### 2. 패키지 설치 및 실행

Bash

```# 의존성 설치
npm install

# 서버 실행

npm start
```

---

## 📊 분석 로직 상세 (Analysis Logic)

- *`GitHub Analyzer`*는 다음 요소들을 복합적으로 분석합니다.
- **성실성**: 커밋 수, 연속 커밋(Streak), 주말/새벽 활동
- **기여도**: PR 생성, 코드 리뷰 수, 리팩토링/버그수정 커밋
- **소통**: 리뷰 코멘트 이모지 사용, 빠른 리뷰(Fast Review)
- **히든 미션**: 블로그 공유, 커뮤니티 활동, TDD 시도 등
