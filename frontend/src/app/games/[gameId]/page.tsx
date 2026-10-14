import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameLoader } from "@/components/game/GameLoader";
import { gameRegistry, getGame } from "@/games/registry";
import styles from "./page.module.css";

type Params = { gameId: string };

// 정적 내보내기: 레지스트리에 있는 게임만 페이지를 만들고, 그 외 경로는 404
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return gameRegistry.map((game) => ({ gameId: game.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { gameId } = await params;
  const game = getGame(gameId);
  return game ? { title: game.name, description: game.description } : {};
}

export default async function GamePage({ params }: { params: Promise<Params> }) {
  const { gameId } = await params;
  const game = getGame(gameId);
  if (!game) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link href="/" className="btn btn-secondary">
          ← 홈으로
        </Link>
        <h1 className={styles.title}>{game.name}</h1>
      </div>
      <GameLoader gameId={game.id} />
    </div>
  );
}
