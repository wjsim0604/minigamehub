"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readBestScore, recordScore, subscribeBestScore, type BestScoreResult } from "./bestScore";

/**
 * 게임별 로컬 최고 점수를 읽고 기록하는 훅.
 * 서버 렌더(정적 내보내기) 시에는 null을 돌려주어 하이드레이션 불일치를 피한다.
 */
export function useBestScore(gameId: string): {
  bestScore: number | null;
  record: (score: number) => BestScoreResult;
} {
  const bestScore = useSyncExternalStore<number | null>(
    subscribeBestScore,
    () => readBestScore(gameId),
    () => null,
  );
  const record = useCallback((score: number) => recordScore(gameId, score), [gameId]);
  return { bestScore, record };
}
