import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GameLoaderFn, GameProps } from "@/games/types";

const load = vi.fn<GameLoaderFn>();

vi.mock("@/games/loaders", () => ({
  getGameLoader: (id: string) => (id === "fake" ? load : undefined),
}));

const { GameLoader } = await import("./GameLoader");

function FakeGame({ gameId, bestScore }: GameProps) {
  return (
    <p>
      fake game {gameId} best={String(bestScore)}
    </p>
  );
}

describe("GameLoader", () => {
  beforeEach(() => {
    load.mockReset();
  });

  it("게임 코드를 불러와 렌더링한다", async () => {
    load.mockResolvedValueOnce({ default: FakeGame });
    render(<GameLoader gameId="fake" />);
    expect(screen.getByRole("status").textContent).toContain("불러오는 중");
    expect(await screen.findByText("fake game fake best=0")).toBeTruthy();
  });

  it("로드 실패 시 오류 안내와 다시 시도 버튼을 표시하고, 다시 시도하면 로드한다", async () => {
    load.mockRejectedValueOnce(new Error("ChunkLoadError")).mockResolvedValueOnce({ default: FakeGame });
    render(<GameLoader gameId="fake" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("게임을 불러오지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText(/fake game fake/)).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
