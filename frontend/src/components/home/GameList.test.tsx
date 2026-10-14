import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { gameRegistry } from "@/games/registry";
import { recordScore, __resetBestScoreSessionForTests } from "@/lib/bestScore";
import { GameList, type GameCardData } from "./GameList";

const cards: GameCardData[] = [...gameRegistry];

describe("GameList (홈)", () => {
  it("레지스트리의 모든 게임을 카드로 표시하고 게임 경로로 연결한다", () => {
    __resetBestScoreSessionForTests();
    render(<GameList games={cards} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("/games/2048");
    expect(links[1]?.getAttribute("href")).toBe("/games/jump");
    expect(screen.getByRole("heading", { name: "2048" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "점프 게임" })).toBeTruthy();
    for (const game of cards) expect(screen.getByText(game.description)).toBeTruthy();
  });

  it("레지스트리에 항목을 추가하면 카드가 추가된다", () => {
    const extra: GameCardData = {
      id: "new-game",
      name: "새 게임",
      description: "설명",
      thumbnail: "/thumbnails/new-game.svg",
      path: "/games/new-game",
    };
    render(<GameList games={[...cards, extra]} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /새 게임 플레이/ }).getAttribute("href")).toBe("/games/new-game");
  });

  it("로컬 최고 점수가 있으면 표시하고, 없으면 '기록 없음'", () => {
    __resetBestScoreSessionForTests();
    recordScore("2048", 1234);
    render(<GameList games={cards} />);
    expect(screen.getByText("최고 점수 1,234")).toBeTruthy();
    expect(screen.getByText("기록 없음")).toBeTruthy();
  });

  it("레지스트리가 비어 있으면 안내를 표시한다", () => {
    render(<GameList games={[]} />);
    expect(screen.getByText("준비 중인 게임이 없습니다.")).toBeTruthy();
  });

  it("썸네일 로드 실패 시 게임 이름 텍스트로 대체한다", () => {
    const { container } = render(<GameList games={cards.slice(0, 1)} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    // 제목(h2) + 대체 텍스트
    expect(screen.getAllByText("2048")).toHaveLength(2);
  });
});
