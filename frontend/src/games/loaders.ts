import type { GameId } from "./registry";
import type { GameLoaderFn } from "./types";

/**
 * 게임별 지연 로더 (클라이언트 전용: GameLoader에서만 import).
 *
 * `import()`로 작성해 게임 코드가 게임별 청크로 분리되고, 해당 게임 화면 진입 시에만 내려받는다.
 * `Record<GameId, ...>` 타입이므로 레지스트리에 게임을 추가하고 여기에 로더를 빠뜨리면 타입 체크가 실패한다.
 */
export const gameLoaders: Record<GameId, GameLoaderFn> = {
  "2048": () => import("./2048/Game2048"),
  jump: () => import("./jump/JumpGame"),
};

export function getGameLoader(id: string): GameLoaderFn | undefined {
  return Object.prototype.hasOwnProperty.call(gameLoaders, id) ? gameLoaders[id as GameId] : undefined;
}
