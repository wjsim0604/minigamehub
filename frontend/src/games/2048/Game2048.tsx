"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { GameOverOverlay, Overlay, OverlayActions, OverlayText } from "@/components/game/Overlay";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import type { GameProps } from "@/games/types";
import type { BestScoreResult } from "@/lib/bestScore";
import { arrowKeyToDirection, getSwipeDirection } from "@/lib/input";
import { createGame, gameReducer, type GameAction, type GameState, type NewGameRandoms } from "./logic";
import styles from "./Game2048.module.css";

function newGameRandoms(): NewGameRandoms {
  return [Math.random(), Math.random(), Math.random(), Math.random()];
}

function tileClass(value: number): string {
  if (value === 0) return "";
  return (value <= 2048 ? styles[`v${value}`] : styles.vBig) ?? "";
}

export default function Game2048({ bestScore, onGameOver }: GameProps) {
  const [state, setState] = useState<GameState>(() => createGame(newGameRandoms()));
  const [overResult, setOverResult] = useState<BestScoreResult | null>(null);
  // 연속 입력이 유실되지 않도록 최신 상태를 ref로 즉시 갱신하며 순서대로 처리한다
  const stateRef = useRef(state);
  const onGameOverRef = useRef(onGameOver);
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const apply = useCallback((action: GameAction) => {
    const prev = stateRef.current;
    const next = gameReducer(prev, action);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    if (next.status === "over" && prev.status !== "over") {
      // 게임오버 알림 (공통 생명주기). 2차 점수 제출도 이 지점에 연결된다.
      setOverResult(onGameOverRef.current(next.score));
    }
  }, []);

  const startNewGame = useCallback(() => {
    const current = stateRef.current;
    // 끝나지 않은 게임을 새로 시작하면, 그때까지의 점수로 최고 점수를 갱신한다
    if (current.status !== "over" && current.score > 0) onGameOverRef.current(current.score);
    setOverResult(null);
    apply({ type: "newGame", randoms: newGameRandoms() });
  }, [apply]);

  const moveTo = useCallback(
    (direction: ReturnType<typeof arrowKeyToDirection>) => {
      if (!direction) return;
      apply({ type: "move", direction, randoms: [Math.random(), Math.random()] });
    },
    [apply],
  );

  // 키보드: 방향키 (페이지 스크롤 방지)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const direction = arrowKeyToDirection(event.key);
      if (!direction) return;
      event.preventDefault();
      moveTo(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveTo]);

  // iOS 등에서 touch-action만으로 스크롤이 막히지 않는 경우를 대비해 touchmove 기본 동작 차단
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const prevent = (event: TouchEvent) => event.preventDefault();
    board.addEventListener("touchmove", prevent, { passive: false });
    return () => board.removeEventListener("touchmove", prevent);
  }, []);

  // 화면을 벗어날 때 진행 중이던 점수로 최고 점수 갱신
  useEffect(
    () => () => {
      const current = stateRef.current;
      if (current.status !== "over" && current.score > 0) onGameOverRef.current(current.score);
    },
    [],
  );

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStart.current = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    moveTo(getSwipeDirection(touch.clientX - start.x, touch.clientY - start.y));
  };

  const displayedBest = bestScore === null ? null : Math.max(bestScore, state.score);

  return (
    <section className={styles.game} aria-label="2048 게임">
      <div className={styles.top}>
        <ScoreBoard score={state.score} bestScore={displayedBest} />
        <button type="button" className="btn" onClick={startNewGame}>
          새 게임
        </button>
      </div>
      <p className={styles.help}>방향키(↑ ↓ ← →) 또는 보드를 스와이프해 타일을 움직이세요.</p>

      <div
        ref={boardRef}
        className={styles.boardWrap}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
      >
        <div className={styles.board} role="grid" aria-label="2048 보드" aria-readonly="true">
          {state.board.map((row, r) => (
            <div key={r} role="row" style={{ display: "contents" }}>
              {row.map((value, c) => (
                <div
                  key={c}
                  role="gridcell"
                  className={`${styles.cell} ${tileClass(value)}`}
                  data-digits={value === 0 ? undefined : String(value).length}
                  data-testid={`cell-${r}-${c}`}
                  aria-label={value === 0 ? "빈 칸" : String(value)}
                >
                  {value === 0 ? "" : value}
                </div>
              ))}
            </div>
          ))}
        </div>

        {state.status === "won" ? (
          <Overlay title="2048 달성!">
            <OverlayText>축하합니다! 계속해서 더 높은 점수에 도전할 수 있어요.</OverlayText>
            <OverlayActions>
              <button type="button" className="btn" onClick={() => apply({ type: "continue" })}>
                계속하기
              </button>
              <button type="button" className="btn btn-secondary" onClick={startNewGame}>
                새 게임
              </button>
            </OverlayActions>
          </Overlay>
        ) : null}

        {state.status === "over" ? (
          <GameOverOverlay score={state.score} result={overResult}>
            <OverlayActions>
              <button type="button" className="btn" onClick={startNewGame}>
                다시 하기
              </button>
            </OverlayActions>
          </GameOverOverlay>
        ) : null}
      </div>
    </section>
  );
}
