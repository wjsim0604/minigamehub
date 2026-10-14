# 외부 API 스펙 (api.md)

> 프론트엔드 ↔ 게이트웨이 사이의 API 계약입니다. 작성: planner / 구현: backend / 사용: frontend
> 서비스 간 내부 API는 `contracts/`(OpenAPI 등)에 정의하고, 여기에는 외부에 노출되는 API만 적습니다.
> **엔드포인트는 이 문서에 먼저 정의한 뒤 구현합니다.** 스펙을 바꿀 때는 planner에게 요청합니다.

> **현재 상태 (2026-10-14):** 1차(MVP)는 백엔드가 없으므로 외부 API가 **없습니다** (ADR-0003 제안). 게임 목록은 frontend 정적 레지스트리, 최고 점수는 브라우저 localStorage를 사용합니다.
> 아래 내용은 **2차(랭킹)에서 정의 예정**이며, 후보 목록은 확정이 아닙니다. 구현하지 마세요.

## 1. 공통 규칙 (2차에서 확정)
- Base URL: `<미정, 예: https://api.<도메인>/v1>`
- 인증: `<미정, 예: Authorization: Bearer <JWT>>` - 로그인 방식 결정 후 확정
- 요청/응답 형식: `application/json`
- 날짜·시간: ISO 8601, UTC (제안)
- 페이지네이션: `<미정>`
- 상관관계 ID 헤더: `X-Request-Id` (제안)
- 멱등성: 점수 제출 등 재시도 가능한 쓰기 요청은 `Idempotency-Key` 헤더 사용 (제안)

### 공통 에러 응답
```json
{
  "code": "ERROR_CODE",
  "message": "사용자에게 보여줄 수 있는 메시지",
  "details": [],
  "requestId": "..."
}
```

| HTTP | code 예시 | 의미 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 입력값 오류 |
| 401 | `UNAUTHORIZED` | 인증 필요/만료 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `NOT_FOUND` | 대상 없음 |
| 409 | `CONFLICT` | 중복/상태 충돌 |
| 429 | `RATE_LIMITED` | 요청 빈도 초과 (제안) |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

## 2. 엔드포인트 목록
1차(MVP): 없음.

2차 후보 (미확정, 상태 = 후보):
| ID | 메서드 | 경로 | 설명 | 인증 | 담당 서비스 | 상태 |
|---|---|---|---|---|---|---|
| - | - | `<로그인 방식에 따라 결정>` | 가입·로그인·로그아웃·내 정보 (FR-101) | - | user-service | 후보 |
| - | POST | `/scores` (가칭) | 점수 제출 (FR-102) | 필요 | score-service | 후보 |
| - | GET | `/games/{gameId}/leaderboard` (가칭) | 게임별 리더보드 조회 (FR-103) | 불필요(제안) | score-service | 후보 |

> `gameId`는 frontend 게임 레지스트리의 `id`와 동일한 값을 사용합니다 (architecture.md 2장).

## 3. 엔드포인트 상세 (추가하며 작성)
2차 착수 시 작성 예정.

## 4. 변경 이력
| 날짜 | 변경 | 하위 호환 | 작성자 |
|---|---|---|---|
| 2026-10-14 | 초기 작성: MVP 외부 API 없음 명시, 2차 후보 목록 기재 | - | planner |
