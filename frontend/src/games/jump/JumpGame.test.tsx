import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { BestScoreResult } from "@/lib/bestScore";
import JumpGame from "./JumpGame";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("JumpGame 화면", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom은 canvas를 지원하지 않으므로 그리기를 생략한다 (로직은 logic.test.ts에서 검증)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    setVisibility("visible");
    vi.useRealTimers();
  });

  it("시작 대기 상태로 표시되고 스페이스로 시작한다 (스크롤 방지)", () => {
    render(<JumpGame gameId="jump" bestScore={0} onGameOver={vi.fn()} />);
    expect(screen.getByText("스페이스 또는 화면을 탭하여 시작")).toBeTruthy();
    let notPrevented = true;
    act(() => {
      notPrevented = fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    expect(notPrevented).toBe(false);
    expect(screen.queryByText("스페이스 또는 화면을 탭하여 시작")).toBeNull();
  });

  it("게임 영역을 탭하면 시작한다", () => {
    render(<JumpGame gameId="jump" bestScore={0} onGameOver={vi.fn()} />);
    act(() => {
      fireEvent.pointerDown(screen.getByTestId("jump-area"), { button: 0 });
    });
    expect(screen.queryByText("스페이스 또는 화면을 탭하여 시작")).toBeNull();
  });

  it("진행 중 시간이 지나면 점수가 오른다", () => {
    render(<JumpGame gameId="jump" bestScore={0} onGameOver={vi.fn()} />);
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowUp" });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(Number(screen.getByTestId("score").textContent)).toBeGreaterThan(0);
  });

  it("탭이 숨겨지면 일시정지되고, 일시정지 중에는 점수가 오르지 않으며, 입력 시 재개한다 (FR-006)", () => {
    render(<JumpGame gameId="jump" bestScore={0} onGameOver={vi.fn()} />);
    act(() => {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      setVisibility("hidden");
    });
    expect(screen.getByText("계속하려면 스페이스 또는 화면을 탭하세요")).toBeTruthy();
    const pausedScore = screen.getByTestId("score").textContent;
    act(() => {
      setVisibility("visible");
      vi.advanceTimersByTime(2000);
    });
    // 복귀해도 바로 재개하지 않음
    expect(screen.getByText("계속하려면 스페이스 또는 화면을 탭하세요")).toBeTruthy();
    expect(screen.getByTestId("score").textContent).toBe(pausedScore);
    act(() => {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    expect(screen.queryByText("계속하려면 스페이스 또는 화면을 탭하세요")).toBeNull();
  });

  it("점프하지 않으면 충돌해 게임오버가 되고, 점수를 알린 뒤 다시 하기로 재시작한다", () => {
    const onGameOver = vi.fn((score: number): BestScoreResult => ({ bestScore: score, isNewBest: true }));
    render(<JumpGame gameId="jump" bestScore={0} onGameOver={onGameOver} />);
    act(() => {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("게임 오버")).toBeTruthy();
    expect(screen.getByText("최고 기록!")).toBeTruthy();
    expect(onGameOver).toHaveBeenCalledTimes(1);
    const finalScore = onGameOver.mock.calls[0]![0];
    expect(finalScore).toBeGreaterThan(0);
    expect(screen.getByTestId("score").textContent).toBe(finalScore.toLocaleString("ko-KR"));

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "다시 하기" }));
    });
    expect(screen.queryByText("게임 오버")).toBeNull();
    expect(screen.getByTestId("score").textContent).toBe("0");
  });

  it("게임오버 직후 짧은 시간 동안은 스페이스 입력으로 재시작되지 않는다", () => {
    render(<JumpGame gameId="jump" bestScore={0} onGameOver={vi.fn(() => ({ bestScore: 1, isNewBest: false }))} />);
    act(() => {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    // 충돌 직후를 노리기 위해 짧은 간격으로 진행시키다가 게임오버가 되면 즉시 입력
    let overSeen = false;
    for (let i = 0; i < 1000 && !overSeen; i++) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      overSeen = screen.queryByText("게임 오버") !== null;
    }
    expect(overSeen).toBe(true);
    act(() => {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    expect(screen.getByText("게임 오버")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      fireEvent.keyDown(window, { key: " ", code: "Space" });
    });
    expect(screen.queryByText("게임 오버")).toBeNull();
  });

  it("화면을 벗어나면 게임 루프와 리스너가 정리된다", () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const removeDoc = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<JumpGame gameId="jump" bestScore={0} onGameOver={vi.fn()} />);
    unmount();
    expect(cancel).toHaveBeenCalled();
    expect(removeDoc).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(fireEvent.keyDown(window, { key: " ", code: "Space" })).toBe(true);
  });
});
