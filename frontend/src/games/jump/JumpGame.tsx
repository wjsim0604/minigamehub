"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GameOverOverlay, Overlay, OverlayActions, OverlayText } from "@/components/game/Overlay";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import type { GameProps } from "@/games/types";
import type { BestScoreResult } from "@/lib/bestScore";
import { isInteractiveTarget, isSpaceKey } from "@/lib/input";
import { advance, createInitialState, pause, pressAction, scoreOf, WORLD, type JumpState, type JumpStatus } from "./logic";
import { drawJumpGame } from "./render";
import styles from "./JumpGame.module.css";

interface View {
  status: JumpStatus;
  score: number;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

export default function JumpGame({ bestScore, onGameOver }: GameProps) {
  // 게임 상태는 매 프레임 바뀌므로 ref에 두고, 화면 표시용 값(상태·점수)만 React state로 동기화한다
  const stateRef = useRef<JumpState>(createInitialState(1));
  const [view, setView] = useState<View>({ status: "ready", score: 0 });
  const [overResult, setOverResult] = useState<BestScoreResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  /** 상태 반영 + 화면 표시 동기화 + 게임오버 알림 */
  const commit = useCallback((prev: JumpState, next: JumpState) => {
    if (next === prev) return;
    stateRef.current = next;
    if (next.status === "over" && prev.status !== "over") {
      // 게임오버 알림 (공통 생명주기). 2차 점수 제출도 이 지점에 연결된다.
      setOverResult(onGameOverRef.current(scoreOf(next)));
    } else if (prev.status === "over" && next.status !== "over") {
      setOverResult(null);
    }
    const score = scoreOf(next);
    setView((v) => (v.status === next.status && v.score === score ? v : { status: next.status, score }));
  }, []);

  const handleAction = useCallback(() => {
    const prev = stateRef.current;
    commit(prev, pressAction(prev, performance.now()));
  }, [commit]);

  // 게임 루프 (requestAnimationFrame + 경과 시간 기반)
  useEffect(() => {
    stateRef.current = createInitialState(randomSeed());
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    let frameId = 0;
    let lastTime: number | null = null;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = rect.width || WORLD.width;
      const cssHeight = rect.height || WORLD.height;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    };

    const frame = (time: number) => {
      const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
      lastTime = time;
      const prev = stateRef.current;
      commit(prev, advance(prev, dt, time));
      if (ctx && canvas) drawJumpGame(ctx, stateRef.current, canvas.width, canvas.height);
      frameId = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [commit]);

  // 키보드: 스페이스 / ↑ (페이지 스크롤 방지)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!isSpaceKey(event) && event.key !== "ArrowUp") return;
      // 버튼·링크에 포커스가 있으면 스페이스는 그 요소의 클릭에 맡긴다 (이중 처리 방지)
      if (isSpaceKey(event) && isInteractiveTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat) return; // 키를 누르고 있을 때의 자동 반복은 무시
      handleAction();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAction]);

  // 탭 전환·창 최소화 시 자동 일시정지 (FR-006)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const prev = stateRef.current;
        commit(prev, pause(prev));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [commit]);

  // 탭/클릭으로 점프. 오버레이 안의 버튼 클릭은 버튼에 맡긴다.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    handleAction();
  };

  return (
    <section className={styles.game} aria-label="점프 게임">
      <div className={styles.top}>
        <ScoreBoard score={view.score} bestScore={bestScore} />
      </div>
      <p className={styles.help}>스페이스바·↑ 키 또는 게임 화면을 탭해 점프하세요. 땅에 있을 때만 점프할 수 있어요.</p>

      <div className={styles.area} onPointerDown={onPointerDown} data-testid="jump-area">
        <canvas ref={canvasRef} className={styles.canvas} width={WORLD.width} height={WORLD.height} aria-hidden="true" />

        {view.status === "ready" ? (
          <Overlay title="점프 게임">
            <OverlayText>스페이스 또는 화면을 탭하여 시작</OverlayText>
          </Overlay>
        ) : null}

        {view.status === "paused" ? (
          <Overlay title="일시정지">
            <OverlayText>계속하려면 스페이스 또는 화면을 탭하세요</OverlayText>
          </Overlay>
        ) : null}

        {view.status === "over" ? (
          <GameOverOverlay score={view.score} result={overResult}>
            <OverlayActions>
              <button type="button" className="btn" onClick={handleAction}>
                다시 하기
              </button>
            </OverlayActions>
            <OverlayText>스페이스 또는 탭으로도 다시 시작할 수 있어요</OverlayText>
          </GameOverOverlay>
        ) : null}
      </div>
    </section>
  );
}
