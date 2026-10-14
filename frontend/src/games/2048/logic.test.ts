import { describe, expect, it } from "vitest";
import {
  addRandomTile,
  canMove,
  createEmptyBoard,
  createGame,
  gameReducer,
  getEmptyCells,
  hasTile,
  isGameOver,
  move,
  slideRowLeft,
  type Board,
  type GameState,
} from "./logic";

const NO_SPAWN_VALUE = 0.5; // 0.5 -> 2 타일

describe("slideRowLeft", () => {
  it.each([
    [[0, 0, 0, 0], [0, 0, 0, 0], 0],
    [[2, 0, 0, 0], [2, 0, 0, 0], 0],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
    [[2, 0, 2, 0], [4, 0, 0, 0], 4],
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4],
    [[4, 4, 8, 0], [8, 8, 0, 0], 8],
    [[2, 2, 4, 4], [4, 8, 0, 0], 12],
    [[8, 4, 2, 2], [8, 4, 4, 0], 4],
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
    [[1024, 1024, 0, 0], [2048, 0, 0, 0], 2048],
  ])("%j -> %j (점수 +%i)", (input, expected, gained) => {
    const result = slideRowLeft(input);
    expect(result.row).toEqual(expected);
    expect(result.gained).toBe(gained);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const row = [2, 2, 0, 0];
    slideRowLeft(row);
    expect(row).toEqual([2, 2, 0, 0]);
  });
});

describe("move", () => {
  const board: Board = [
    [2, 0, 2, 4],
    [0, 4, 0, 4],
    [2, 0, 0, 0],
    [2, 4, 8, 8],
  ];

  it("왼쪽", () => {
    const result = move(board, "left");
    expect(result.board).toEqual([
      [4, 4, 0, 0],
      [8, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 4, 16, 0],
    ]);
    expect(result.gained).toBe(4 + 8 + 16);
    expect(result.moved).toBe(true);
  });

  it("오른쪽", () => {
    const result = move(board, "right");
    expect(result.board).toEqual([
      [0, 0, 4, 4],
      [0, 0, 0, 8],
      [0, 0, 0, 2],
      [0, 2, 4, 16],
    ]);
    expect(result.gained).toBe(4 + 8 + 16);
  });

  it("위", () => {
    const result = move(board, "up");
    expect(result.board).toEqual([
      [4, 8, 2, 8],
      [2, 0, 8, 8],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(result.gained).toBe(4 + 8 + 8);
  });

  it("아래", () => {
    const result = move(board, "down");
    expect(result.board).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 2, 8],
      [4, 8, 8, 8],
    ]);
    expect(result.gained).toBe(4 + 8 + 8);
  });

  it("세로 방향에서도 한 타일은 한 번만 합쳐진다", () => {
    const column: Board = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
    ];
    expect(move(column, "down").board.map((row) => row[0])).toEqual([0, 0, 4, 4]);
    expect(move(column, "up").board.map((row) => row[0])).toEqual([4, 4, 0, 0]);
  });

  it("변화가 없으면 moved=false", () => {
    const stuck: Board = [
      [2, 4, 0, 0],
      [4, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(stuck, "left").moved).toBe(false);
    expect(move(stuck, "up").moved).toBe(false);
    expect(move(stuck, "right").moved).toBe(true);
  });

  it("원본 보드를 변경하지 않는다", () => {
    const copy = board.map((row) => [...row]);
    move(board, "left");
    expect(board).toEqual(copy);
  });
});

describe("addRandomTile", () => {
  it("빈 칸에 2(90%) 또는 4(10%)를 추가한다", () => {
    const empty = createEmptyBoard();
    const withTwo = addRandomTile(empty, 0, 0.1);
    const withFour = addRandomTile(empty, 0, 0.09);
    expect(withTwo[0]![0]).toBe(2);
    expect(withFour[0]![0]).toBe(4);
    expect(getEmptyCells(withTwo)).toHaveLength(15);
  });

  it("난수에 따라 빈 칸 중 하나를 고른다", () => {
    const board: Board = [
      [2, 2, 2, 2],
      [2, 2, 2, 2],
      [2, 2, 2, 0],
      [2, 2, 0, 2],
    ];
    expect(addRandomTile(board, 0, NO_SPAWN_VALUE)[2]![3]).toBe(2);
    expect(addRandomTile(board, 0.99, NO_SPAWN_VALUE)[3]![2]).toBe(2);
  });

  it("빈 칸이 없으면 그대로 반환", () => {
    const full: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(addRandomTile(full, 0.5, 0.5)).toBe(full);
  });
});

describe("게임오버 판정", () => {
  it("빈 칸이 있으면 게임오버가 아니다", () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 0],
    ];
    expect(canMove(board)).toBe(true);
    expect(isGameOver(board)).toBe(false);
  });

  it("빈 칸이 없어도 가로로 인접한 같은 숫자가 있으면 게임오버가 아니다", () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 8, 8],
    ];
    expect(isGameOver(board)).toBe(false);
  });

  it("빈 칸이 없어도 세로로 인접한 같은 숫자가 있으면 게임오버가 아니다", () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 8],
      [4, 2, 4, 8],
    ];
    expect(isGameOver(board)).toBe(false);
  });

  it("빈 칸도, 인접한 같은 숫자도 없으면 게임오버", () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(isGameOver(board)).toBe(true);
    for (const dir of ["up", "down", "left", "right"] as const) {
      expect(move(board, dir).moved).toBe(false);
    }
  });
});

describe("2048 감지", () => {
  it("2048 이상 타일이 있으면 true", () => {
    const board = createEmptyBoard();
    expect(hasTile(board)).toBe(false);
    board[1]![2] = 2048;
    expect(hasTile(board)).toBe(true);
  });
});

describe("gameReducer", () => {
  function stateWith(board: Board, overrides: Partial<GameState> = {}): GameState {
    return { board, score: 0, status: "playing", keepPlaying: false, gameNumber: 0, ...overrides };
  }

  it("새 게임은 타일 2개, 점수 0으로 시작한다", () => {
    const game = createGame([0, 0.5, 0.99, 0.5]);
    const tiles = game.board.flat().filter((v) => v !== 0);
    expect(tiles).toHaveLength(2);
    expect(tiles.every((v) => v === 2 || v === 4)).toBe(true);
    expect(game.score).toBe(0);
    expect(game.status).toBe("playing");
  });

  it("이동 시 점수를 더하고 새 타일 1개를 추가한다", () => {
    const state = stateWith([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const next = gameReducer(state, { type: "move", direction: "left", randoms: [0, NO_SPAWN_VALUE] });
    expect(next.score).toBe(4);
    expect(next.board[0]).toEqual([4, 2, 0, 0]);
    expect(getEmptyCells(next.board)).toHaveLength(14);
  });

  it("변화가 없는 입력은 무시한다 (새 타일 없음)", () => {
    const state = stateWith([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(gameReducer(state, { type: "move", direction: "left", randoms: [0, 0.5] })).toBe(state);
  });

  it("연속 입력을 순서대로 모두 처리한다", () => {
    let state = stateWith([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    state = gameReducer(state, { type: "move", direction: "left", randoms: [0.99, NO_SPAWN_VALUE] });
    state = gameReducer(state, { type: "move", direction: "down", randoms: [0.99, NO_SPAWN_VALUE] });
    expect(state.score).toBe(4);
    expect(state.board[3]![0]).toBe(4);
  });

  it("2048을 처음 만들면 won 상태가 되고, 계속하기 후에는 다시 안내하지 않는다", () => {
    const state = stateWith([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    const won = gameReducer(state, { type: "move", direction: "left", randoms: [0.5, NO_SPAWN_VALUE] });
    expect(won.status).toBe("won");
    expect(won.score).toBe(2048);

    // won 상태에서는 이동 입력을 받지 않음
    expect(gameReducer(won, { type: "move", direction: "down", randoms: [0, 0.5] })).toBe(won);

    const continued = gameReducer(won, { type: "continue" });
    expect(continued.status).toBe("playing");
    expect(continued.keepPlaying).toBe(true);

    const after = gameReducer(continued, { type: "move", direction: "down", randoms: [0, NO_SPAWN_VALUE] });
    expect(after.status).toBe("playing");
  });

  it("더 이상 움직일 수 없게 되면 over 상태가 된다", () => {
    const state = stateWith([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [0, 4, 2, 8],
    ]);
    // 왼쪽으로 밀면 [4,2,8,0] 이 되고 마지막 빈 칸에 2가 생성됨
    const next = gameReducer(state, { type: "move", direction: "left", randoms: [0, NO_SPAWN_VALUE] });
    expect(next.board[3]).toEqual([4, 2, 8, 2]);
    expect(next.status).toBe("over");
    expect(gameReducer(next, { type: "move", direction: "up", randoms: [0, 0.5] })).toBe(next);
  });

  it("게임오버 상태에서 새 게임을 하면 점수 0, 새 보드로 재시작한다", () => {
    const over = stateWith(createEmptyBoard(), { status: "over", score: 1234, gameNumber: 3 });
    const next = gameReducer(over, { type: "newGame", randoms: [0, 0.5, 0.5, 0.5] });
    expect(next.status).toBe("playing");
    expect(next.score).toBe(0);
    expect(next.gameNumber).toBe(4);
    expect(next.board.flat().filter((v) => v !== 0)).toHaveLength(2);
  });

  it("2048을 만든 이동으로 막혔다면 계속하기 시 게임오버가 된다", () => {
    const won = stateWith(
      [
        [2048, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      { status: "won" },
    );
    expect(gameReducer(won, { type: "continue" }).status).toBe("over");
  });
});
