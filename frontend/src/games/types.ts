import type { ComponentType } from "react";
import type { BestScoreResult } from "@/lib/bestScore";

/**
 * 모든 게임 모듈이 따르는 공통 인터페이스 (architecture.md 게임 레지스트리 원칙 3: 공통 생명주기).
 *
 * - 마운트: 게임 화면 진입 시 GameLoader가 지연 로딩한 뒤 렌더링
 * - 언마운트: 게임은 자신의 루프·이벤트 리스너를 반드시 정리
 * - 게임오버 알림: 게임은 끝날 때 `onGameOver(score)`를 한 번 호출한다.
 *   (MVP: 로컬 최고 점수 갱신 / 2차: 이 지점에 점수 제출 연결)
 */
export interface GameProps {
  gameId: string;
  /** 현재 로컬 최고 점수. 아직 읽지 못했으면(정적 렌더 단계) null */
  bestScore: number | null;
  /** 게임오버 알림. 최고 점수 갱신 결과를 돌려준다. */
  onGameOver: (score: number) => BestScoreResult;
}

export type GameComponent = ComponentType<GameProps>;

export interface GameModule {
  default: GameComponent;
}

/** 게임 레지스트리 항목 */
export interface GameDefinition {
  /** 게임 고유 식별자 (kebab-case, 변경 금지: URL, localStorage 키, 2차 gameId로 사용) */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 홈 카드에 표시되는 한 줄 설명 */
  description: string;
  /** 썸네일 이미지 경로 (public/ 기준) */
  thumbnail: string;
  /** 게임 화면 경로 (`/games/{id}`) */
  path: string;
}

/** 게임 코드 지연 로더. 게임 화면 진입 시에만 호출된다. */
export type GameLoaderFn = () => Promise<GameModule>;
