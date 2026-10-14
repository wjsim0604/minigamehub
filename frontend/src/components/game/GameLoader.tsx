"use client";

import { useEffect, useState } from "react";
import { getGameLoader } from "@/games/loaders";
import type { GameComponent } from "@/games/types";
import { useBestScore } from "@/lib/useBestScore";
import styles from "./GameUI.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; Game: GameComponent };

/**
 * 게임 화면 진입 시 해당 게임 코드만 지연 로딩한다 (FR-002, 레지스트리 원칙 4).
 * 로드 실패(네트워크 오류 등) 시 오류 안내와 "다시 시도" 버튼을 표시한다.
 */
export function GameLoader({ gameId }: { gameId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const { bestScore, record } = useBestScore(gameId);

  useEffect(() => {
    const load = getGameLoader(gameId);
    if (!load) return;
    let cancelled = false;
    load()
      .then((module) => {
        if (!cancelled) setState({ status: "ready", Game: module.default });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, attempt]);

  if (state.status === "error") {
    return (
      <div className={styles.loaderBox} role="alert">
        <p>게임을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className={styles.loaderBox} role="status">
        게임을 불러오는 중…
      </div>
    );
  }

  const { Game } = state;
  return <Game gameId={gameId} bestScore={bestScore} onGameOver={record} />;
}
