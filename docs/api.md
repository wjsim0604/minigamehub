# 외부 API 스펙 (api.md)

> 프론트엔드 ↔ 게이트웨이 사이의 API 계약입니다. 작성: planner / 구현: backend / 사용: frontend
> 서비스 간 내부 API는 `contracts/`(OpenAPI 등)에 정의하고, 여기에는 외부에 노출되는 API만 적습니다.
> **엔드포인트는 이 문서에 먼저 정의한 뒤 구현합니다.** 스펙을 바꿀 때는 planner에게 요청합니다.

## 1. 공통 규칙
- Base URL: `<https://api.example.com/v1>`
- 인증: `<Authorization: Bearer <JWT>>`
- 요청/응답 형식: `application/json`
- 날짜·시간: `<ISO 8601, UTC>`
- 페이지네이션: `<?page=1&size=20 / cursor 방식>`
- 상관관계 ID 헤더: `<X-Request-Id>`

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
| 500 | `INTERNAL_ERROR` | 서버 오류 |

## 2. 엔드포인트 목록
| ID | 메서드 | 경로 | 설명 | 인증 | 담당 서비스 | 상태 |
|---|---|---|---|---|---|---|
| API-001 | POST | `/auth/login` | 로그인 | 불필요 | `<user-service>` | 미구현 |

## 3. 엔드포인트 상세 (추가하며 작성)
### API-001 `POST /auth/login`
- 설명: `<...>`
- 요청
```json
{
  "email": "string",
  "password": "string"
}
```
- 성공 응답 `200`
```json
{
  "accessToken": "string",
  "expiresIn": 3600
}
```
- 오류: `400 VALIDATION_FAILED`, `401 UNAUTHORIZED`
- 비고: `<속도 제한, 권한 조건 등>`

## 4. 변경 이력
| 날짜 | 변경 | 하위 호환 | 작성자 |
|---|---|---|---|
| `<YYYY-MM-DD>` | `<초기 작성>` | - | planner |
