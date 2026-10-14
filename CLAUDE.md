# 프로젝트 세팅 문서 (CLAUDE.md)

> 모든 에이전트가 작업 전에 읽는 공통 문서입니다. 짧고 구체적으로 유지하고, `<...>` 부분은 프로젝트에 맞게 채워주세요.

## 1. 프로젝트 개요
- 서비스 이름: MiniGameHub
- 한 줄 설명: 여러 미니게임을 제공하고, 사용자가 원하는 게임을 선택해서 즐길 수 있는 웹 서비스
- 주요 사용자: `<대상 사용자>`
- 현재 단계: 기획
- 아키텍처: **MSA (Microservices Architecture)**

## 2. 기술 스택
| 영역 | 기술 |
|---|---|
| 프론트엔드 | React, TypeScript, Next.js (`<App Router / Pages Router>`) |
| 백엔드 서비스 | Node.js, NestJS (TypeScript) - 기본 서비스 스택 |
| 백엔드 서비스 (Python) | Python (`<FastAPI 등>`) - `<용도: 데이터 처리 / AI / 배치 등>` |
| API Gateway | `<NestJS Gateway / Kong / Nginx / AWS API Gateway 등>` |
| 서비스 간 통신 | 동기: `<REST / gRPC>`, 비동기: `<Kafka / RabbitMQ / Redis Pub/Sub 등>` |
| DB | MySQL (`<8.x>`, 문자셋 utf8mb4) - **서비스별 독립 DB** |
| ORM / 마이그레이션 | `<TypeORM / Prisma 등>` |
| 컨테이너 / 오케스트레이션 | Docker, `<docker compose(로컬) / Kubernetes(운영)>` |
| CI/CD | `<GitHub Actions 등>` |
| 테스트 | `<Jest(NestJS), Vitest/Jest + React Testing Library(프론트), pytest(Python), Playwright(E2E)>` |
| 패키지 매니저 | `<npm / pnpm / yarn>`, Python: `<pip / poetry / uv>` |

## 3. 서비스 구성
| 서비스 | 책임 | 스택 | DB | 비고 |
|---|---|---|---|---|
| gateway | 라우팅, 인증 토큰 검증, 요청 집계 | `<...>` | - | 외부 요청의 단일 진입점 |
| `<user-service>` | 회원, 인증/인가 | NestJS | `user_db` | |
| `<order-service>` | 주문 | NestJS | `order_db` | |
| `<example-py-service>` | `<데이터 처리/AI 등>` | Python | `<...>` | |

> 서비스 목록은 기획 단계에서 `docs/architecture.md`에 확정한 뒤 이 표를 갱신합니다.

## 4. 디렉터리 구조 (모노레포 기준)
```
/
├── frontend/                 # Next.js 웹 프론트엔드
├── gateway/                  # API Gateway
├── services/
│   ├── user-service/         # NestJS 서비스 (서비스별 독립 빌드·테스트·Dockerfile)
│   ├── order-service/
│   └── <py-service>/         # Python 서비스
├── contracts/                # 서비스 간 계약 (OpenAPI, proto, 이벤트 스키마)
├── infra/                    # docker-compose, k8s, CI/CD, DB 초기화
├── docs/
│   ├── requirements.md       # 요구사항
│   ├── architecture.md       # 서비스 경계, 통신 방식, 데이터 소유권
│   ├── api.md                # 외부(프론트↔게이트웨이) API 스펙
│   ├── events.md             # 이벤트/메시지 목록과 페이로드
│   └── decisions.md          # 아키텍처 결정 기록(ADR)
├── tests/                    # E2E, 서비스 간 통합 테스트
└── .claude/agents/           # 역할별 서브에이전트 정의
```

## 5. MSA 핵심 규칙
- **서비스는 자기 DB만 접근한다.** 다른 서비스의 DB·테이블을 직접 조회/수정하지 않고, 반드시 API 또는 이벤트로 통신
- **DB는 서비스별로 분리** (MySQL 인스턴스 또는 스키마 단위). 서비스 간 JOIN, 외래키 공유 금지
- **서비스 간 코드 직접 import 금지.** 공유가 필요한 타입·스키마는 `contracts/`를 통해서만 공유
- **계약 우선(Contract First):** API/이벤트는 `contracts/`와 `docs/`에 먼저 정의한 뒤 구현. 하위 호환을 깨는 변경은 버전을 올리고 사람에게 먼저 확인
- **서비스는 독립적으로 빌드·테스트·배포 가능**해야 함 (자체 Dockerfile, 자체 테스트)
- **분산 트랜잭션을 쓰지 않는다.** 여러 서비스에 걸친 처리는 이벤트 기반(Saga 등)으로 설계하고 `docs/architecture.md`에 흐름을 기록
- **장애 전파 방지:** 서비스 간 동기 호출에는 타임아웃, 재시도, 실패 시 대체 동작(fallback)을 정의
- **멱등성:** 이벤트 소비자와 재시도되는 API는 중복 요청을 안전하게 처리
- **서비스별 설정과 시크릿은 분리**하고, 서비스 간 인증 방식을 명시 (`<서비스 토큰 / mTLS 등>`)
- **로깅·추적:** 모든 요청에 상관관계 ID(correlation/trace ID)를 전달하고 로그에 남김
- **헬스체크:** 각 서비스는 헬스체크 엔드포인트를 제공

## 6. 자주 쓰는 명령어
```bash
# 전체 로컬 환경 (DB, 메시지 브로커, 서비스)
docker compose -f infra/docker-compose.yml up -d

# 특정 서비스 개발 (예: services/user-service/)
<npm install>
<npm run start:dev>
<npm run test>
<npm run lint && npm run build>

# Python 서비스 (services/<py-service>/)
<pip install -r requirements.txt 또는 poetry install>
<uvicorn app.main:app --reload>
<pytest>
<ruff check .>

# 프론트엔드 (frontend/)
<npm install>
<npm run dev>
<npm run test>
<npm run lint && npm run typecheck && npm run build>

# 계약/통합 테스트, E2E
<계약 테스트 명령>
<npx playwright test>
```

## 7. 개발 규칙
- 브랜치: `main`은 직접 수정 금지. 작업은 `agent/<서비스명>-<작업명>` 브랜치에서 진행
- 커밋: 작은 단위로, 메시지는 `<타입>(<서비스명>): <내용>` 형식 (예: `feat(user-service): 로그인 API 추가`)
- 한 작업(PR)은 **가능하면 한 서비스** 안에서 끝낸다. 여러 서비스를 건드려야 하면 계약 변경 → 제공자 → 소비자 순서로 분리
- 코드 스타일: ESLint/Prettier(프론트·NestJS), `<ruff/black 등>`(Python) 설정 기준
- TypeScript는 `any` 사용을 피하고 타입을 명시
- NestJS: 서비스 내부는 모듈 단위(controller / service / dto / entity)로 구성하고, 입력은 DTO + validation으로 검증
- 새 기능에는 반드시 테스트를 함께 작성
- 기존 코드 스타일과 네이밍을 따르고, 요청 범위 밖의 리팩터링은 하지 않음

## 8. 에이전트 역할 분담
| 에이전트 | 담당 | 수정 가능 범위 | 금지 사항 |
|---|---|---|---|
| planner (웹 기획) | 요구사항, 서비스 경계, 화면, API/이벤트 스펙 정리 | `docs/` | 코드 수정 |
| frontend (웹 프론트) | Next.js UI, 상태 관리, 게이트웨이 API 연동 | `frontend/` | 백엔드·인프라 수정 |
| backend (웹 백엔드) | 서비스 구현, 해당 서비스의 MySQL 스키마·쿼리, 서비스 간 연동 | 지정된 `services/<서비스명>/`, `gateway/` | 담당 외 서비스 수정, 프론트·인프라 수정 |
| security-infra (보안·인프라) | 보안 점검, 컨테이너·배포·CI/CD, 서비스 간 인증 | `infra/` (설정 변경은 승인 후) | 시크릿 열람·출력, 운영 환경 직접 변경 |
| qa | 테스트 작성·실행, 계약/통합/E2E 검증, 버그 리포트 | `tests/` | 소스 코드 직접 수정 (버그는 보고) |

> 백엔드 서비스가 많아지면 서비스별(또는 도메인별) 백엔드 에이전트로 나누고, 각자 담당 서비스 디렉터리만 수정하도록 합니다.

### 협업 흐름
```
planner → (requirements, architecture, api, events, contracts/)
        → frontend / 각 서비스 backend 병렬 구현
        → qa (계약·통합·E2E 검증) → security-infra 점검 → 사람이 리뷰/머지
```
- 에이전트끼리는 컨텍스트를 공유하지 않으므로 **`docs/`와 `contracts/` 문서가 유일한 소통 수단**입니다.
- 계약(API·이벤트)을 바꿔야 하면 직접 고치지 말고 planner에게 요청하고, 소비자 서비스 영향 범위를 함께 확인합니다.
- 각 에이전트는 작업 전에 `CLAUDE.md`와 관련 `docs/`, `contracts/`를 읽습니다.

## 9. DB (MySQL) 규칙
- 서비스마다 별도 DB(스키마)를 사용하고, 다른 서비스의 DB 접속 정보는 갖지 않음
- 스키마 변경은 해당 서비스의 마이그레이션 파일로만 수행 (수동 DDL 금지)
- 마이그레이션 실행은 로컬 개발 DB에서만 하고, 운영 DB는 사람이 승인 후 진행
- 컬럼 삭제·타입 변경 등 되돌리기 어려운 변경은 반드시 사람에게 먼저 확인 (다른 서비스가 이벤트·API로 해당 데이터를 쓰고 있지 않은지 확인)
- 쿼리는 파라미터 바인딩 사용 (문자열 이어붙이기 금지), 조회가 잦은 컬럼은 인덱스 검토
- 테스트는 테스트 전용 DB를 사용하고 개발·운영 데이터에 영향 주지 않음

## 10. 보안·권한 규칙
- `.env`, 키, 토큰, 비밀번호, DB 접속 정보 등 시크릿은 읽거나 출력하거나 커밋하지 않음
- 운영 DB·운영 서버·운영 클러스터에 직접 접근하지 않음
- 외부 요청 인증은 게이트웨이에서, 서비스 간 호출은 서비스 인증으로 이중 확인
- 아래 작업은 반드시 **사람의 승인 후** 진행
  - 파일/데이터 삭제, 마이그레이션 실행
  - 배포, 인프라 설정 변경
  - 외부 서비스 결제·과금이 발생하는 작업
  - 의존성 대량 추가·업그레이드
  - 하위 호환을 깨는 API/이벤트 계약 변경

## 11. 작업 완료 기준 (Definition of Done)
- [ ] 요구사항을 충족하고 `docs/`·`contracts/`와 구현이 일치
- [ ] 린트·타입 체크·빌드 통과 (변경한 서비스 기준)
- [ ] 관련 테스트 작성 및 해당 서비스 테스트 통과, 계약 변경 시 소비자 영향 확인
- [ ] 다른 서비스의 DB·코드를 직접 건드리지 않음
- [ ] 보안 규칙 위반 없음 (시크릿 노출, 과도한 권한 등)
- [ ] 변경 사항 요약과 확인이 필요한 점을 보고

## 12. 작업 방식
1. 큰 작업은 먼저 계획을 제시하고 사람의 확인을 받은 뒤 진행
2. 작업 전 관련 `docs/`, `contracts/`와 기존 코드를 읽어 맥락을 파악
3. 어느 서비스의 책임인지 불명확하면 추측하지 말고 질문
4. 완료 후 변경 서비스, 변경 파일, 실행한 테스트, 남은 이슈를 요약

## 13. 알려진 주의사항
- `<예: 로컬에서는 docker compose로 DB와 브로커를 먼저 실행>`
- `<예: 테스트 시 다른 서비스 호출은 모킹/계약 테스트로 대체>`
- `<예: Python 서비스는 이벤트로만 데이터를 받음>`
