import type { GameDefinition } from "./types";

/**
 * 게임 레지스트리 (게임 목록의 단일 등록 지점, 서버·클라이언트 공용 정적 데이터).
 *
 * 새 게임 추가 방법:
 *  1. `src/games/<id>/` 아래에 GameProps를 받는 기본 내보내기 컴포넌트를 작성한다.
 *  2. 아래 배열에 항목 하나를 추가한다 → 홈 카드와 `/games/<id>` 페이지가 자동으로 생긴다.
 *  3. `src/games/loaders.ts`에 지연 로더 한 줄을 추가한다 (빠뜨리면 타입 체크가 실패한다).
 *  4. `public/thumbnails/<id>.svg` 썸네일을 추가한다.
 *
 * 주의: 이 파일에는 게임 코드 import를 두지 않는다. 서버 컴포넌트(홈, 라우팅)가 이 파일을
 * import하므로, 여기에 `import()`가 있으면 모든 게임 코드가 홈 번들에 미리 포함된다.
 */
export const gameRegistry = [
  {
    id: "2048",
    name: "2048",
    description: "같은 숫자 타일을 밀어 합쳐 2048을 만들어 보세요.",
    thumbnail: "/thumbnails/2048.svg",
    path: "/games/2048",
  },
  {
    id: "jump",
    name: "점프 게임",
    description: "다가오는 장애물을 점프로 피하며 최대한 멀리 달려 보세요.",
    thumbnail: "/thumbnails/jump.svg",
    path: "/games/jump",
  },
  {
    id: "match3",
    name: "블록 팡",
    description: "이웃한 블록을 바꿔 같은 모양 3개 이상을 맞추고, 60초 동안 연쇄로 점수를 쌓아 보세요.",
    thumbnail: "/thumbnails/match3.svg",
    path: "/games/match3",
  },
] as const satisfies readonly GameDefinition[];

export type GameId = (typeof gameRegistry)[number]["id"];

export function getGame(id: string): GameDefinition | undefined {
  return gameRegistry.find((game) => game.id === id);
}
