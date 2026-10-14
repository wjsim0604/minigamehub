import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { BestScoreResult } from "@/lib/bestScore";
import { BOARD_SIZE, TIME_LIMIT_MS, findPossibleMove, hasMatch, swapCells, type Board, type Pos } from "./logic";
import Match3Game, { HINT_DELAY_MS, REVERT_MS, SWAP_MS } from "./Match3Game";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

function cellEl(pos: Pos): HTMLElement {
  return screen.getByTestId(`cell-${pos.row}-${pos.col}`);
}

/** 화면의 보드를 읽는다 (data-kind) */
function readBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => Number(cellEl({ row, col }).dataset.kind)),
  );
}

/** 교환해도 매치가 생기지 않는 인접한 두 칸 (블록 종류가 다른) */
function findInvalidSwap(board: Board): { a: Pos; b: Pos } {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 1; col++) {
      const a = { row, col };
      const b = { row, col: col + 1 };
      if (board[row]![col] !== board[row]![col + 1] && !hasMatch(swapCells(board, a, b))) return { a, b };
    }
  }
  throw new Error("무효 교환을 찾지 못함");
}

function click(pos: Pos) {
  act(() => {
    fireEvent.click(cellEl(pos));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function score(): number {
  return Number((screen.getByTestId("score").textContent ?? "").replace(/,/g, ""));
}

function timeLeft(): number {
  return Number(screen.getByTestId("time-left").textContent);
}

/** 연쇄가 모두 끝날 때까지 진행 (보드의 aria-busy가 false가 될 때까지) */
function settle() {
  for (let i = 0; i < 200; i++) {
    if (screen.getByRole("grid").getAttribute("aria-busy") !== "true") return;
    advance(50);
  }
  throw new Error("연쇄가 끝나지 않음");
}

describe("Match3Game 화면", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 보드 시드를 고정 (Math.random → createRng 시드)
    vi.spyOn(Math, "random").mockReturnValue(0.123456);
  });

  afterEach(() => {
    setVisibility("visible");
    vi.useRealTimers();
  });

  it("7x7 보드, 점수 0, 남은 시간 60초, 시작 보드에 3매치 없음", () => {
    render(<Match3Game gameId="match3" bestScore={42} onGameOver={vi.fn()} />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(score()).toBe(0);
    expect(screen.getByTestId("best-score").textContent).toBe("42");
    expect(timeLeft()).toBe(60);
    const board = readBoard();
    expect(hasMatch(board)).toBe(false);
    expect(findPossibleMove(board)).not.toBeNull();
    // 모든 블록은 이름(색+모양)으로 식별 가능
    expect(cellEl({ row: 0, col: 0 }).getAttribute("aria-label")).toMatch(/1행 1열/);
  });

  it("첫 조작 전에는 타이머가 흐르지 않는다", () => {
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    advance(3000);
    expect(timeLeft()).toBe(60);
  });

  it("두 블록을 차례로 클릭해 유효하게 교환하면 제거·연쇄 후 점수가 오른다", () => {
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    const move = findPossibleMove(readBoard())!;
    click(move.a);
    expect(cellEl(move.a).getAttribute("aria-pressed")).toBe("true");
    click(move.b);
    expect(cellEl(move.a).getAttribute("aria-pressed")).toBe("false");
    settle();
    expect(score()).toBeGreaterThan(0);
    expect(hasMatch(readBoard())).toBe(false);
    expect(findPossibleMove(readBoard())).not.toBeNull();
  });

  it("매치가 없는 교환은 원래대로 되돌아가고 점수는 그대로", () => {
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    const before = readBoard();
    const { a, b } = findInvalidSwap(before);
    click(a);
    click(b);
    // 잠시 교환된 모습을 보여 준다
    expect(readBoard()).toEqual(swapCells(before, a, b));
    advance(SWAP_MS + REVERT_MS + 10);
    expect(readBoard()).toEqual(before);
    expect(score()).toBe(0);
    expect(screen.getByRole("grid").getAttribute("aria-busy")).toBe("false");
  });

  it("교환·연쇄 처리 중에는 입력을 무시한다", () => {
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    const move = findPossibleMove(readBoard())!;
    click(move.a);
    click(move.b);
    expect(screen.getByRole("grid").getAttribute("aria-busy")).toBe("true");
    const other = { row: (move.a.row + 3) % BOARD_SIZE, col: (move.a.col + 3) % BOARD_SIZE };
    click(other);
    expect(cellEl(other).getAttribute("aria-pressed")).toBe("false");
  });

  it("드래그(스와이프)로 인접 블록과 교환한다", () => {
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    const before = readBoard();
    const { a, b } = findInvalidSwap(before); // b는 a의 오른쪽
    const el = cellEl(a);
    act(() => {
      fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(el, { pointerId: 1, clientX: 140, clientY: 102 });
      fireEvent.pointerUp(el, { pointerId: 1, clientX: 140, clientY: 102 });
      fireEvent.click(el); // 드래그 직후 click은 무시된다
    });
    expect(readBoard()).toEqual(swapCells(before, a, b));
    expect(cellEl(a).getAttribute("aria-pressed")).toBe("false");
    advance(SWAP_MS + REVERT_MS + 10);
    expect(readBoard()).toEqual(before);
  });

  it("5초 동안 입력이 없으면 가능한 수 하나를 힌트로 표시하고, 입력하면 사라진다", () => {
    const { container } = render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    advance(HINT_DELAY_MS - 100);
    expect(container.querySelectorAll('[data-hint="true"]')).toHaveLength(0);
    advance(200);
    const hinted = [...container.querySelectorAll<HTMLElement>('[data-hint="true"]')];
    expect(hinted).toHaveLength(2);
    const expected = findPossibleMove(readBoard())!;
    expect(hinted.map((el) => el.dataset.testid).sort()).toEqual(
      [`cell-${expected.a.row}-${expected.a.col}`, `cell-${expected.b.row}-${expected.b.col}`].sort(),
    );
    click({ row: 0, col: 0 });
    expect(container.querySelectorAll('[data-hint="true"]')).toHaveLength(0);
  });

  it("60초가 지나면 게임오버 오버레이와 함께 점수를 한 번 알리고, 다시 하기로 재시작한다", () => {
    const onGameOver = vi.fn((s: number): BestScoreResult => ({ bestScore: Math.max(s, 1), isNewBest: false }));
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={onGameOver} />);
    click({ row: 0, col: 0 }); // 첫 조작으로 타이머 시작
    advance(30_000);
    expect(timeLeft()).toBe(30);
    advance(TIME_LIMIT_MS);
    expect(screen.getByText("게임 오버")).toBeTruthy();
    expect(timeLeft()).toBe(0);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver).toHaveBeenCalledWith(0);
    // 게임오버 후 입력 무시
    click({ row: 1, col: 1 });
    expect(cellEl({ row: 1, col: 1 }).getAttribute("aria-pressed")).toBe("false");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "다시 하기" }));
    });
    expect(screen.queryByText("게임 오버")).toBeNull();
    expect(timeLeft()).toBe(60);
    expect(score()).toBe(0);
  });

  it("시간이 끝날 때 진행 중인 연쇄는 마무리한 뒤 게임오버", () => {
    const onGameOver = vi.fn((s: number): BestScoreResult => ({ bestScore: s, isNewBest: true }));
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={onGameOver} />);
    click({ row: 0, col: 0 });
    click({ row: 0, col: 0 }); // 선택 해제 (타이머는 시작됨)
    advance(TIME_LIMIT_MS - 100);
    const move = findPossibleMove(readBoard())!;
    click(move.a);
    click(move.b);
    advance(SWAP_MS + 150); // 이 사이에 시간 종료
    expect(timeLeft()).toBe(0);
    expect(screen.queryByText("게임 오버")).toBeNull();
    expect(onGameOver).not.toHaveBeenCalled();
    settle();
    expect(screen.getByText("게임 오버")).toBeTruthy();
    expect(screen.getByText("최고 기록!")).toBeTruthy();
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver.mock.calls[0]![0]).toBeGreaterThan(0);
    expect(onGameOver.mock.calls[0]![0]).toBe(score());
  });

  it("탭이 숨겨지면 타이머가 멈추고, 계속하기로 재개한다 (FR-006)", () => {
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    click({ row: 0, col: 0 });
    advance(10_000);
    expect(timeLeft()).toBe(50);
    act(() => {
      setVisibility("hidden");
    });
    expect(screen.getByText("일시정지")).toBeTruthy();
    act(() => {
      setVisibility("visible");
    });
    advance(20_000);
    expect(timeLeft()).toBe(50);
    expect(screen.getByText("일시정지")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    });
    expect(screen.queryByText("일시정지")).toBeNull();
    advance(5_000);
    expect(timeLeft()).toBe(45);
  });

  it("새 게임 버튼은 진행 중 점수를 기록하고 새 보드·60초로 재시작한다", () => {
    const onGameOver = vi.fn((s: number): BestScoreResult => ({ bestScore: s, isNewBest: true }));
    render(<Match3Game gameId="match3" bestScore={0} onGameOver={onGameOver} />);
    const move = findPossibleMove(readBoard())!;
    click(move.a);
    click(move.b);
    settle();
    const earned = score();
    expect(earned).toBeGreaterThan(0);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "새 게임" }));
    });
    expect(onGameOver).toHaveBeenCalledWith(earned);
    expect(score()).toBe(0);
    expect(timeLeft()).toBe(60);
  });

  it("화면을 벗어나면 리스너와 예약된 타이머가 정리된다", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Match3Game gameId="match3" bestScore={0} onGameOver={vi.fn()} />);
    const move = findPossibleMove(readBoard())!;
    click(move.a);
    click(move.b);
    unmount();
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
});
