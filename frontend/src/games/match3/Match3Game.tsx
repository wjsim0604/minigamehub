"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { GameOverOverlay, Overlay, OverlayActions, OverlayText } from "@/components/game/Overlay";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import type { GameProps } from "@/games/types";
import type { BestScoreResult } from "@/lib/bestScore";
import { getSwipeDirection, type SwipeDirection } from "@/lib/input";
import { BlockShape, blockStyle } from "./blocks";
import {
  TIME_LIMIT_MS,
  createBoard,
  createRng,
  ensurePlayable,
  findPossibleMove,
  hasMatch,
  inBounds,
  isAdjacent,
  posKey,
  resolveStep,
  samePos,
  swapCells,
  type Board,
  type Move,
  type Pos,
  type Rng,
} from "./logic";
import styles from "./Match3Game.module.css";

/** 교환 표시 시간 (ms) */
export const SWAP_MS = 160;
/** 무효 교환 되돌림 표시 시간 */
export const REVERT_MS = 160;
/** 제거(페이드·축소) 표시 시간 */
export const CLEAR_MS = 220;
/** 낙하 표시 시간 (다음 연쇄 단계까지의 지연) */
export const FALL_MS = 260;
/** 자동 섞기 안내 표시 시간 */
export const SHUFFLE_MS = 700;
/** 무입력 시 힌트 표시까지의 시간 */
export const HINT_DELAY_MS = 5000;
const TICK_MS = 200;
/** 이 거리(px) 이상 끌면 드래그/스와이프 교환 (셀이 작은 모바일을 고려해 공통 임계값보다 작게) */
const DRAG_THRESHOLD_PX = 18;
/** 드래그 교환 직후 뒤따르는 click 이벤트를 무시하는 시간 */
const CLICK_SUPPRESS_MS = 400;

type Status = "ready" | "playing" | "paused" | "over";
type Motion = { kind: "swap" | "fall"; dx: number; dy: number };

interface View {
  board: Board;
  score: number;
  /** ready: 첫 조작 전(타이머 정지) / playing / paused: 탭 이탈 / over */
  status: Status;
  remainingMs: number;
  selected: Pos | null;
  /** 교환·연쇄 처리 중 (입력 무시) */
  busy: boolean;
  /** 제거 중인 셀 (posKey) */
  clearing: ReadonlySet<string> | null;
  /** 셀별 이동 애니메이션 (어디서 왔는지, 셀 단위) */
  motion: (Motion | null)[][] | null;
  /** 애니메이션 재시작용 키 */
  animKey: number;
  hint: Move | null;
  /** 현재(마지막) 연쇄 단계 */
  chain: number;
  shuffled: boolean;
  /** 입력 횟수 (힌트 대기 타이머 재시작용) */
  inputCount: number;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

function initialView(board: Board): View {
  return {
    board,
    score: 0,
    status: "ready",
    remainingMs: TIME_LIMIT_MS,
    selected: null,
    busy: false,
    clearing: null,
    motion: null,
    animKey: 0,
    hint: null,
    chain: 0,
    shuffled: false,
    inputCount: 0,
  };
}

function canInput(view: View): boolean {
  return (view.status === "ready" || view.status === "playing") && !view.busy && view.remainingMs > 0;
}

function emptyMotion(board: Board): (Motion | null)[][] {
  return board.map((row) => row.map(() => null));
}

/** 교환된 두 셀이 서로의 자리에서 미끄러져 오도록 */
function swapMotion(board: Board, a: Pos, b: Pos): (Motion | null)[][] {
  const motion = emptyMotion(board);
  motion[a.row]![a.col] = { kind: "swap", dx: b.col - a.col, dy: b.row - a.row };
  motion[b.row]![b.col] = { kind: "swap", dx: a.col - b.col, dy: a.row - b.row };
  return motion;
}

function fallMotion(fall: number[][]): (Motion | null)[][] {
  return fall.map((row) => row.map((d) => (d > 0 ? { kind: "fall", dx: 0, dy: -d } : null)));
}

const NEIGHBOR: Record<SwipeDirection, Pos> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

function cellFromTarget(target: EventTarget | null): Pos | null {
  if (typeof Element === "undefined" || !(target instanceof Element)) return null;
  const cell = target.closest<HTMLElement>("[data-row][data-col]");
  if (!cell) return null;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

export default function Match3Game({ bestScore, onGameOver }: GameProps) {
  const [initial] = useState(() => {
    const rng = createRng(randomSeed());
    return { rng, view: initialView(createBoard(rng)) };
  });
  const [view, setView] = useState<View>(initial.view);
  const [overResult, setOverResult] = useState<BestScoreResult | null>(null);
  // 타이머·연쇄 콜백에서 최신 상태를 쓰기 위해 ref에 즉시 반영한다
  const viewRef = useRef<View>(initial.view);
  const rngRef = useRef<Rng>(initial.rng);
  const onGameOverRef = useRef(onGameOver);
  const overNotifiedRef = useRef(false);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pos: Pos; x: number; y: number; pointerId: number; done: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const update = useCallback((fn: (v: View) => View) => {
    const prev = viewRef.current;
    const next = fn(prev);
    if (next === prev) return;
    viewRef.current = next;
    setView(next);
  }, []);

  /** 언마운트·새 게임 시 함께 정리되는 setTimeout */
  const later = useCallback((fn: () => void, ms: number) => {
    const timers = timersRef.current;
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }, []);

  const endGame = useCallback(() => {
    update((v) => ({
      ...v,
      status: "over",
      busy: false,
      selected: null,
      hint: null,
      clearing: null,
      remainingMs: 0,
    }));
    if (!overNotifiedRef.current) {
      overNotifiedRef.current = true;
      // 게임오버 알림 (공통 생명주기). 2차 점수 제출도 이 지점에 연결된다.
      setOverResult(onGameOverRef.current(viewRef.current.score));
    }
  }, [update]);

  /** 교환·연쇄 처리가 끝났을 때: 시간이 다 됐으면 게임오버, 아니면 입력 허용 */
  const becomeIdle = useCallback(() => {
    if (viewRef.current.remainingMs <= 0) {
      endGame();
      return;
    }
    update((v) => ({ ...v, busy: false, shuffled: false, motion: null, clearing: null }));
  }, [endGame, update]);

  const finishChain = (board: Board) => {
    if (viewRef.current.remainingMs <= 0) {
      update((v) => ({ ...v, board, motion: null, clearing: null }));
      endGame();
      return;
    }
    const playable = ensurePlayable(board, rngRef.current);
    if (!playable.shuffled) {
      update((v) => ({ ...v, board: playable.board }));
      becomeIdle();
      return;
    }
    // 가능한 수가 없으면 자동 섞기 (결과도 3매치 없음 + 가능한 수 보장)
    update((v) => ({ ...v, board: playable.board, shuffled: true, motion: null, clearing: null, selected: null }));
    later(becomeIdle, SHUFFLE_MS);
  };

  const runChain = (board: Board, chain: number) => {
    const step = resolveStep(board, rngRef.current, chain);
    if (!step) {
      finishChain(board);
      return;
    }
    const cleared = new Set(step.cleared.map(posKey));
    update((v) => ({ ...v, board, clearing: cleared, motion: null, chain, score: v.score + step.points }));
    later(() => {
      update((v) => ({
        ...v,
        board: step.board,
        clearing: null,
        motion: fallMotion(step.fall),
        animKey: v.animKey + 1,
      }));
      later(() => runChain(step.board, chain + 1), FALL_MS);
    }, CLEAR_MS);
  };

  const attemptSwap = (a: Pos, b: Pos) => {
    const current = viewRef.current;
    if (!canInput(current) || !inBounds(current.board, a) || !inBounds(current.board, b) || !isAdjacent(a, b)) return;
    const original = current.board;
    const swapped = swapCells(original, a, b);
    const valid = hasMatch(swapped);
    update((v) => ({
      ...v,
      status: v.status === "ready" ? "playing" : v.status,
      board: swapped,
      selected: null,
      hint: null,
      busy: true,
      chain: 0,
      motion: swapMotion(swapped, a, b),
      animKey: v.animKey + 1,
      inputCount: v.inputCount + 1,
    }));
    later(() => {
      if (valid) {
        runChain(swapped, 1);
        return;
      }
      // 매치가 없으면 원래대로 되돌린다
      update((v) => ({ ...v, board: original, motion: swapMotion(original, a, b), animKey: v.animKey + 1 }));
      later(becomeIdle, REVERT_MS);
    }, SWAP_MS);
  };

  const onCellClick = (pos: Pos, timeStamp: number) => {
    if (timeStamp < suppressClickUntilRef.current) return; // 드래그 교환 직후의 click
    const current = viewRef.current;
    if (!canInput(current)) return;
    const selected = current.selected;
    if (selected && isAdjacent(selected, pos)) {
      attemptSwap(selected, pos);
      return;
    }
    update((v) => ({
      ...v,
      status: v.status === "ready" ? "playing" : v.status,
      selected: selected && samePos(selected, pos) ? null : pos,
      hint: null,
      inputCount: v.inputCount + 1,
    }));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const pos = cellFromTarget(event.target);
    if (!pos) return;
    dragRef.current = { pos, x: event.clientX, y: event.clientY, pointerId: event.pointerId, done: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.done || event.pointerId !== drag.pointerId) return;
    const direction = getSwipeDirection(event.clientX - drag.x, event.clientY - drag.y, DRAG_THRESHOLD_PX);
    if (!direction) return;
    drag.done = true;
    suppressClickUntilRef.current = event.timeStamp + CLICK_SUPPRESS_MS;
    const offset = NEIGHBOR[direction];
    attemptSwap(drag.pos, { row: drag.pos.row + offset.row, col: drag.pos.col + offset.col });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const startNewGame = () => {
    const current = viewRef.current;
    // 끝나지 않은 게임을 새로 시작하면, 그때까지의 점수로 최고 점수를 갱신한다
    if (current.status !== "over" && current.score > 0) onGameOverRef.current(current.score);
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current.clear();
    const rng = createRng(randomSeed());
    rngRef.current = rng;
    overNotifiedRef.current = false;
    dragRef.current = null;
    setOverResult(null);
    update(() => initialView(createBoard(rng)));
  };

  const resume = () => {
    update((v) => (v.status === "paused" ? { ...v, status: "playing", inputCount: v.inputCount + 1 } : v));
  };

  // 제한 시간 (진행 중일 때만 감소, 일시정지 중에는 멈춤)
  const status = view.status;
  useEffect(() => {
    if (status !== "playing") return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      const current = viewRef.current;
      if (current.status !== "playing" || current.remainingMs <= 0) return;
      const remainingMs = Math.max(0, current.remainingMs - elapsed);
      update((v) => ({ ...v, remainingMs, ...(remainingMs <= 0 ? { selected: null, hint: null } : null) }));
      // 연쇄 처리 중이면 마무리된 뒤(becomeIdle/finishChain) 게임오버
      if (remainingMs <= 0 && !current.busy) endGame();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, update, endGame]);

  // 탭 전환·창 최소화 시 타이머 일시정지 (FR-006)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        update((v) => (v.status === "playing" ? { ...v, status: "paused" } : v));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [update]);

  // 일정 시간 입력이 없으면 가능한 수 하나를 힌트로 표시
  const idle = canInput(view) && view.hint === null;
  const inputCount = view.inputCount;
  useEffect(() => {
    if (!idle) return;
    const id = setTimeout(() => {
      update((v) => (canInput(v) && v.hint === null ? { ...v, hint: findPossibleMove(v.board) } : v));
    }, HINT_DELAY_MS);
    return () => clearTimeout(id);
  }, [idle, inputCount, update]);

  // iOS 등에서 touch-action만으로 스크롤이 막히지 않는 경우를 대비해 touchmove 기본 동작 차단
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const prevent = (event: TouchEvent) => event.preventDefault();
    board.addEventListener("touchmove", prevent, { passive: false });
    return () => board.removeEventListener("touchmove", prevent);
  }, []);

  // 화면을 벗어날 때: 예약된 연쇄 타이머 정리 + 진행 중이던 점수로 최고 점수 갱신
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      const current = viewRef.current;
      if (current.status !== "over" && current.score > 0 && !overNotifiedRef.current) {
        onGameOverRef.current(current.score);
      }
    };
  }, []);

  const displayedBest = bestScore === null ? null : Math.max(bestScore, view.score);
  const seconds = Math.ceil(view.remainingMs / 1000);
  const hintKeys = view.hint ? new Set([posKey(view.hint.a), posKey(view.hint.b)]) : null;
  const message = view.shuffled
    ? "가능한 수가 없어 보드를 섞었어요"
    : view.chain >= 2
      ? `${view.chain}연쇄!`
      : view.status === "ready"
        ? "블록을 처음 움직이면 60초 타이머가 시작돼요"
        : "";

  return (
    <section className={styles.game} aria-label="블록 팡 게임">
      <div className={styles.top}>
        <ScoreBoard score={view.score} bestScore={displayedBest} />
        <div className={`${styles.timeBox} ${seconds <= 10 ? styles.timeLow : ""}`}>
          <span className={styles.timeLabel}>남은 시간</span>
          <span className={styles.timeValue} role="timer" aria-label={`남은 시간 ${seconds}초`} data-testid="time-left">
            {seconds}
          </span>
        </div>
        <button type="button" className="btn" onClick={startNewGame}>
          새 게임
        </button>
      </div>
      <div className={styles.timeBar} aria-hidden="true">
        <div className={styles.timeBarFill} style={{ transform: `scaleX(${view.remainingMs / TIME_LIMIT_MS})` }} />
      </div>
      {/* 메시지는 설명 문구 자리에 겹쳐 표시해서 레이아웃이 밀리거나 보드를 가리지 않게 함 */}
      <div className={styles.info}>
        <p className={styles.message} aria-live="polite" data-testid="match3-message">
          {message}
        </p>
        <p className={styles.help}>
          이웃한 두 블록을 차례로 누르거나 끌어서 바꾸세요. 같은 블록 3개 이상이 가로·세로로 이어지면 터집니다.
        </p>
      </div>

      <div
        ref={boardRef}
        className={styles.boardWrap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={styles.board}
          role="grid"
          aria-label="블록 팡 보드"
          aria-busy={view.busy}
          data-busy={view.busy ? "true" : undefined}
        >
          {view.board.map((row, r) => (
            <div key={r} role="row" style={{ display: "contents" }}>
              {row.map((kind, c) => {
                const pos = { row: r, col: c };
                const key = posKey(pos);
                const selected = view.selected !== null && samePos(view.selected, pos);
                const hinted = hintKeys?.has(key) ?? false;
                const clearing = view.clearing?.has(key) ?? false;
                const motion = view.motion?.[r]?.[c] ?? null;
                const blockClass = [
                  styles.block,
                  clearing ? styles.clearing : "",
                  motion ? (motion.kind === "swap" ? styles.swapIn : styles.fallIn) : "",
                ].join(" ");
                const motionStyle = motion ? ({ "--dx": motion.dx, "--dy": motion.dy } as CSSProperties) : undefined;
                return (
                  <div key={c} role="gridcell" className={styles.cell}>
                    <button
                      type="button"
                      className={`${styles.cellButton} ${selected ? styles.selected : ""} ${hinted ? styles.hint : ""}`}
                      data-row={r}
                      data-col={c}
                      data-kind={kind}
                      data-hint={hinted ? "true" : undefined}
                      data-testid={`cell-${r}-${c}`}
                      aria-pressed={selected}
                      aria-label={`${blockStyle(kind).name}, ${r + 1}행 ${c + 1}열`}
                      onClick={(event) => onCellClick(pos, event.timeStamp)}
                    >
                      {/* 애니메이션이 있을 때만 키를 바꿔 다시 마운트 → CSS 애니메이션 재시작 */}
                      <span key={motion ? `m${view.animKey}` : "still"} className={blockClass} style={motionStyle}>
                        <BlockShape kind={kind} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {view.status === "paused" ? (
          <Overlay title="일시정지">
            <OverlayText>탭을 벗어나 타이머를 멈췄어요.</OverlayText>
            <OverlayActions>
              <button type="button" className="btn" onClick={resume}>
                계속하기
              </button>
            </OverlayActions>
          </Overlay>
        ) : null}

        {view.status === "over" ? (
          <GameOverOverlay score={view.score} result={overResult}>
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
