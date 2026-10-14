import { GameList } from "@/components/home/GameList";
import styles from "@/components/home/GameList.module.css";
import { gameRegistry } from "@/games/registry";

/** 첫 화면(`/`) = 게임 선택 화면 (FR-001). 랜딩·로그인 없이 바로 게임 카드 그리드를 보여준다. */
export default function HomePage() {
  return (
    <>
      <h1 className={styles.title}>게임 선택</h1>
      <GameList games={gameRegistry} />
    </>
  );
}
