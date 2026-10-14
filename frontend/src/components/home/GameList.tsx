import Link from "next/link";
import type { GameDefinition } from "@/games/types";
import { BestScoreBadge } from "./BestScoreBadge";
import { GameThumbnail } from "./GameThumbnail";
import styles from "./GameList.module.css";

export type GameCardData = GameDefinition;

/** 홈 게임 카드 목록 (FR-001). 레지스트리 데이터만으로 카드를 생성한다. */
export function GameList({ games }: { games: readonly GameCardData[] }) {
  if (games.length === 0) {
    return <p className={styles.empty}>준비 중인 게임이 없습니다.</p>;
  }

  return (
    <ul className={styles.grid}>
      {games.map((game) => (
        <li key={game.id}>
          <Link href={game.path} className={styles.card} aria-label={`${game.name} 플레이 - ${game.description}`}>
            <div className={styles.thumb}>
              <GameThumbnail src={game.thumbnail} name={game.name} />
            </div>
            <div className={styles.body}>
              <h2 className={styles.name}>{game.name}</h2>
              <p className={styles.description}>{game.description}</p>
              <div className={styles.footer}>
                <BestScoreBadge gameId={game.id} className={styles.best} />
                <span className={styles.play} aria-hidden="true">
                  플레이 ▶
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
