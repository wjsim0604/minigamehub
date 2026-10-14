import type { ReactNode } from "react";
import type { BestScoreResult } from "@/lib/bestScore";
import styles from "./GameUI.module.css";

/** 게임 영역 위에 겹쳐 띄우는 안내 오버레이 (시작 대기, 일시정지, 성공, 게임오버 공용) */
export function Overlay({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.overlay} role="dialog" aria-label={title} aria-live="polite">
      <div className={styles.overlayPanel}>
        <p className={styles.overlayTitle}>{title}</p>
        {children}
      </div>
    </div>
  );
}

export function OverlayText({ children }: { children: ReactNode }) {
  return <p className={styles.overlayText}>{children}</p>;
}

export function OverlayActions({ children }: { children: ReactNode }) {
  return <div className={styles.overlayActions}>{children}</div>;
}

/** 게임오버 공통 오버레이: 최종 점수, 최고 점수, 최고 기록 표시 + 동작 버튼 */
export function GameOverOverlay({
  score,
  result,
  children,
}: {
  score: number;
  /** 게임오버 알림 결과 (최고 점수 갱신 여부) */
  result: BestScoreResult | null;
  children?: ReactNode;
}) {
  return (
    <Overlay title="게임 오버">
      {result?.isNewBest ? <p className={styles.newBest}>최고 기록!</p> : null}
      <OverlayText>점수 {score.toLocaleString("ko-KR")}</OverlayText>
      <OverlayText>최고 점수 {(result?.bestScore ?? score).toLocaleString("ko-KR")}</OverlayText>
      {children}
    </Overlay>
  );
}
