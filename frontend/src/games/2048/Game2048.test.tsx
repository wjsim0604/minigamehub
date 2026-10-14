import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { BestScoreResult } from "@/lib/bestScore";
import Game2048 from "./Game2048";

function cell(r: number, c: number): string {
  return screen.getByTestId(`cell-${r}-${c}`).textContent ?? "";
}

describe("Game2048 화면", () => {
  beforeEach(() => {
    // 시작 타일: (2,0)=2, (1,3)=2 / 이후 생성 타일은 빈 칸 중간에 2
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("시작 시 타일 2개가 있고 점수는 0", () => {
    render(<Game2048 gameId="2048" bestScore={10} onGameOver={vi.fn()} />);
    const filled = screen.getAllByRole("gridcell").filter((el) => el.textContent !== "");
    expect(filled).toHaveLength(2);
    expect(cell(2, 0)).toBe("2");
    expect(cell(1, 3)).toBe("2");
    expect(screen.getByTestId("score").textContent).toBe("0");
    expect(screen.getByTestId("best-score").textContent).toBe("10");
  });

  it("방향키로 이동하고, 페이지 스크롤(기본 동작)을 막는다", () => {
    render(<Game2048 gameId="2048" bestScore={0} onGameOver={vi.fn()} />);
    const notPrevented = fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(notPrevented).toBe(false);
    expect(cell(1, 0)).toBe("2");
    expect(cell(1, 3)).not.toBe("2");
    // 방향키가 아닌 키는 막지 않음
    expect(fireEvent.keyDown(window, { key: "a" })).toBe(true);
  });

  it("합쳐지면 점수가 오르고, 최고 점수 표시는 현재 점수 이상으로 유지된다", () => {
    render(<Game2048 gameId="2048" bestScore={0} onGameOver={vi.fn()} />);
    fireEvent.keyDown(window, { key: "ArrowLeft" }); // (1,0)=2, (2,0)=2
    fireEvent.keyDown(window, { key: "ArrowUp" }); // 세로로 합쳐짐 -> 4
    expect(screen.getByTestId("score").textContent).toBe("4");
    expect(screen.getByTestId("best-score").textContent).toBe("4");
  });

  it("30px 이상 스와이프하면 이동하고, 짧은 터치는 무시한다", () => {
    const { container } = render(<Game2048 gameId="2048" bestScore={0} onGameOver={vi.fn()} />);
    const board = container.querySelector('[role="grid"]')!.parentElement!;
    fireEvent.touchStart(board, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(board, { changedTouches: [{ clientX: 80, clientY: 100 }] });
    expect(cell(1, 3)).toBe("2"); // 20px: 무시
    fireEvent.touchStart(board, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(board, { changedTouches: [{ clientX: 40, clientY: 105 }] });
    expect(cell(1, 0)).toBe("2"); // 왼쪽 스와이프
  });

  it("새 게임 버튼은 점수 0, 새 보드로 재시작하고 진행 중 점수를 기록한다", () => {
    const onGameOver = vi.fn((score: number): BestScoreResult => ({ bestScore: score, isNewBest: true }));
    render(<Game2048 gameId="2048" bestScore={0} onGameOver={onGameOver} />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByTestId("score").textContent).toBe("4");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "새 게임" }));
    });
    expect(onGameOver).toHaveBeenCalledWith(4);
    expect(screen.getByTestId("score").textContent).toBe("0");
    expect(screen.getAllByRole("gridcell").filter((el) => el.textContent !== "")).toHaveLength(2);
  });

  it("화면을 벗어나면 키보드 리스너가 정리된다", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Game2048 gameId="2048" bestScore={0} onGameOver={vi.fn()} />);
    unmount();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(fireEvent.keyDown(window, { key: "ArrowLeft" })).toBe(true);
  });
});
