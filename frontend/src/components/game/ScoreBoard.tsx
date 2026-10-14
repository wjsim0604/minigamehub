import styles from "./GameUI.module.css";

function format(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR");
}

/** 현재 점수와 로컬 최고 점수 (FR-003, FR-004, FR-005) */
export function ScoreBoard({ score, bestScore }: { score: number; bestScore: number | null }) {
  return (
    <div className={styles.scoreBoard}>
      <div className={styles.scoreBox}>
        <span className={styles.scoreLabel}>점수</span>
        <span className={styles.scoreValue} data-testid="score">
          {format(score)}
        </span>
      </div>
      <div className={styles.scoreBox}>
        <span className={styles.scoreLabel}>최고</span>
        <span className={styles.scoreValue} data-testid="best-score">
          {format(bestScore)}
        </span>
      </div>
    </div>
  );
}
