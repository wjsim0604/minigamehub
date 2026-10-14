# frontend

MiniGameHub 웹 프론트엔드 (MVP: 게임 목록, 2048, 점프 게임, 로컬 최고 점수).
Next.js App Router + TypeScript, `output: 'export'` 정적 내보내기로 빌드하며 백엔드·외부 API 호출이 없습니다 (ADR-0003).

담당 에이전트: frontend. 2차(랭킹)부터 호출할 API는 `docs/api.md`를 따릅니다.

## 요구 사항
- Node.js 20.9 이상 (개발 확인: Node 22, npm 10)
- 패키지 매니저: npm

## 실행 방법
```bash
cd frontend
npm install          # 의존성 설치 (package-lock.json 기준: npm ci 권장)
npm run dev          # 개발 서버 http://localhost:3000
```

## 검증 명령
```bash
npm run lint         # ESLint (eslint-config-next, any 금지)
npm run typecheck    # next typegen 후 tsc --noEmit (strict)
npm run test         # Vitest + React Testing Library (jsdom)
npm run build        # 정적 내보내기 -> out/
# 한 번에
npm run lint && npm run typecheck && npm run test && npm run build
```

## 정적 결과물 확인
`npm run build` 결과는 `out/`에 생성됩니다 (`next start`는 정적 내보내기에서 사용하지 않음).
아무 정적 파일 서버로 `out/`을 제공하면 됩니다. 예:
```bash
npx serve out                       # 또는
python3 -m http.server 4173 -d out  # http://localhost:4173
```
- `trailingSlash: true`이므로 각 페이지는 `out/games/2048/index.html`처럼 생성됩니다.
- 레지스트리에 없는 경로는 `out/404.html`로 처리됩니다. 호스팅 서버에서 404 시 이 파일을 반환하도록 설정하세요
  (`python3 -m http.server`는 404.html을 쓰지 않으므로 기본 404 응답이 보입니다).

## 구조
```
src/
├── app/                         # 라우팅 (App Router)
│   ├── layout.tsx, globals.css  # 공통 레이아웃(헤더)
│   ├── page.tsx                 # `/` 게임 선택 화면 (첫 화면)
│   ├── not-found.tsx            # 404 "게임을 찾을 수 없습니다"
│   └── games/[gameId]/page.tsx  # 게임 화면 (generateStaticParams, dynamicParams=false)
├── games/
│   ├── registry.ts              # 게임 레지스트리 (id, name, description, thumbnail, path)
│   ├── loaders.ts               # 게임별 지연 로더 (클라이언트 전용, import())
│   ├── types.ts                 # GameProps / GameDefinition (공통 생명주기)
│   ├── 2048/                    # logic.ts(순수 로직) + Game2048.tsx(UI)
│   └── jump/                    # logic.ts(물리·충돌·스폰 순수 로직) + render.ts(canvas) + JumpGame.tsx(UI)
├── components/
│   ├── home/                    # 게임 카드 목록, 썸네일(실패 시 텍스트 대체), 카드 최고 점수
│   └── game/                    # GameLoader(지연 로딩·오류/다시 시도), ScoreBoard, 오버레이
└── lib/
    ├── bestScore.ts             # localStorage `mgh:{gameId}:bestScore` (사용 불가·손상 시 안전 처리)
    ├── useBestScore.ts          # 최고 점수 React 훅 (useSyncExternalStore)
    └── input.ts                 # 스와이프 판정, 키 매핑 등 공통 입력 유틸
public/thumbnails/               # 게임 썸네일 SVG (자체 제작)
```

## 새 게임 추가
1. `src/games/<id>/`에 `GameProps`를 받는 기본 내보내기 컴포넌트를 작성합니다 (다른 게임 모듈 import 금지, 공통 기능은 `src/lib`, `src/components/game` 사용).
   - 게임이 끝나면 `onGameOver(score)`를 한 번 호출하고, 언마운트 시 루프·리스너를 정리합니다.
2. `src/games/registry.ts`에 항목을 추가합니다 → 홈 카드와 `/games/<id>` 페이지가 자동 생성됩니다.
3. `src/games/loaders.ts`에 `"<id>": () => import("./<id>/...")` 한 줄을 추가합니다 (누락 시 타입 체크 실패).
4. `public/thumbnails/<id>.svg`를 추가합니다.

> 레지스트리(`registry.ts`)에는 `import()`를 두지 않습니다. 서버 컴포넌트(홈, 게임 라우트)가 import하는 파일이라
> 여기에 게임 코드 import가 있으면 모든 게임 코드가 홈 번들에 포함됩니다. 그래서 지연 로더를 `loaders.ts`로 분리했습니다.
