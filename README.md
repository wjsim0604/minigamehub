# 프로젝트 템플릿 (MSA + 에이전틱 개발)

Claude Code 같은 AI 에이전트와 함께 개발하기 위한 MSA 프로젝트 뼈대입니다.
공통 규칙(`CLAUDE.md`), 문서 양식(`docs/`), 역할별 에이전트(`.claude/agents/`)가 미리 들어 있습니다.

## 기술 스택
- 프론트엔드: React, TypeScript, Next.js
- 백엔드: NestJS(Node.js) 기본, Python 보조 서비스
- DB: MySQL (서비스별 독립 DB)
- 아키텍처: MSA

## 구조
```
.
├── CLAUDE.md                 # 모든 에이전트가 읽는 공통 규칙 (먼저 채우세요)
├── .claude/agents/           # planner, frontend, backend, security-infra, qa
├── docs/                     # 요구사항, 아키텍처, API, 이벤트, 결정 기록
├── contracts/                # 서비스 간 계약 (OpenAPI, 이벤트 스키마)
├── frontend/                 # Next.js 프론트엔드
├── gateway/                  # API Gateway
├── services/                 # 백엔드 서비스들 (서비스별 폴더)
├── infra/                    # docker-compose, CI/CD, 배포 설정
└── tests/                    # E2E, 통합 테스트
```

## 새 프로젝트 시작 순서
1. 이 템플릿으로 새 레포를 만든다 (GitHub의 **Use this template**).
2. `CLAUDE.md`의 `<...>` 빈칸을 프로젝트에 맞게 채운다 (서비스명, 도구, 명령어 등).
3. Claude Code를 프로젝트 루트에서 실행한다. `CLAUDE.md`는 세션 시작 시 자동으로 읽힌다.
4. planner 에이전트로 `docs/requirements.md`, `docs/architecture.md`부터 정리한다.
5. 계약(`docs/api.md`, `docs/events.md`, `contracts/`)이 정해지면 frontend / backend 에이전트로 구현한다.
6. qa → security-infra 순으로 검증하고, 사람이 diff를 리뷰한 뒤 머지한다.

## 에이전트 사용 예
```
planner 에이전트로 로그인 기능의 요구사항과 API 스펙을 docs/에 정리해줘
backend 에이전트로 user-service에 로그인 API를 구현해줘
frontend 에이전트로 로그인 화면을 만들고 docs/api.md 스펙에 맞춰 연동해줘
qa 에이전트로 로그인 기능의 인수 조건을 검증해줘
```

## 운영 팁
- 에이전트끼리는 컨텍스트를 공유하지 않으므로 `docs/`와 `contracts/` 문서가 소통 수단이다.
- `CLAUDE.md`는 짧고 구체적으로 유지한다. 자세한 내용은 `docs/`로 분리한다.
- 시크릿 접근 제한 같은 중요한 규칙은 문서 지시만 믿지 말고 Claude Code 권한 설정(`.claude/settings.json`)으로도 막는다.
- 처음에는 작은 작업부터 맡기고, 결과를 보며 `CLAUDE.md`를 보강한다.
- 빈 폴더 유지를 위한 `.gitkeep`은 실제 파일이 생기면 지워도 된다.
