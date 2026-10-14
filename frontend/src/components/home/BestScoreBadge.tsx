"use client";

import { useBestScore } from "@/lib/useBestScore";

/** 카드에 표시하는 로컬 최고 점수 (FR-001, FR-005) */
export function BestScoreBadge({ gameId, className }: { gameId: string; className?: string }) {
  const { bestScore } = useBestScore(gameId);
  if (bestScore === null) {
    // 정적 렌더 단계: 레이아웃이 흔들리지 않도록 빈 자리만 차지
    return <span className={className} />;
  }
  return <span className={className}>{bestScore > 0 ? `최고 점수 ${bestScore.toLocaleString("ko-KR")}` : "기록 없음"}</span>;
}
