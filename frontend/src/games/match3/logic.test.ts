import { describe, expect, it } from "vitest";
import {
  BLOCK_KINDS,
  BOARD_SIZE,
  EMPTY,
  SCORE,
  applyGravity,
  cloneBoard,
  createBoard,
  createRng,
  ensurePlayable,
  findAllMoves,
  findMatches,
  findPossibleMove,
  findRuns,
  hasMatch,
  isAdjacent,
  isPlayable,
  isValidSwap,
  refill,
  removeCells,
  resolveAll,
  resolveStep,
  scoreGroups,
  scoreStep,
  shuffleBoard,
  swapCells,
  type Board,
  type Rng,
} from "./logic";

/** 문자열 보드: 숫자는 블록 종류, '.'은 빈 칸 */
function parse(rows: string[]): Board {
  return rows.map((row) => [...row].map((ch) => (ch === "." ? EMPTY : Number(ch))));
}

/** 정해진 값을 순서대로 돌려주는 난수 (끝나면 반복) */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const value = values[i % values.length]!;
    i++;
    return value;
  };
}

/** 종류 k를 내도록 하는 난수 값 */
const kindValue = (k: number) => (k + 0.5) / BLOCK_KINDS;

/** 가능한 수가 없는 7x7 보드 (대각선 패턴, 3매치도 없음) */
const DEAD_BOARD: Board = Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => (r + c) % 6));

describe("createRng", () => {
  it("같은 시드는 같은 수열, 다른 시드는 다른 수열", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createBoard", () => {
  it("7x7, 블록 종류 0~5, 같은 시드면 같은 보드", () => {
    const board = createBoard(createRng(1));
    expect(board).toHaveLength(BOARD_SIZE);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE);
      for (const v of row) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(BLOCK_KINDS);
      }
    }
    expect(createBoard(createRng(1))).toEqual(board);
  });

  it("여러 시드에서 시작 보드에 3매치가 없고 가능한 수가 1개 이상이다", () => {
    for (let seed = 0; seed < 200; seed++) {
      const board = createBoard(createRng(seed));
      expect(hasMatch(board)).toBe(false);
      expect(findPossibleMove(board)).not.toBeNull();
    }
  });

  it("6종류 블록이 모두 사용된다 (충분한 시드에서)", () => {
    const kinds = new Set(createBoard(createRng(7)).flat());
    expect(kinds.size).toBe(BLOCK_KINDS);
  });

  it("블록 종류가 3 미만이면 오류", () => {
    expect(() => createBoard(createRng(1), 7, 2)).toThrow();
  });
});

describe("isAdjacent / swapCells", () => {
  it("상하좌우만 인접, 대각선·같은 칸·먼 칸은 아님", () => {
    expect(isAdjacent({ row: 1, col: 1 }, { row: 0, col: 1 })).toBe(true);
    expect(isAdjacent({ row: 1, col: 1 }, { row: 1, col: 2 })).toBe(true);
    expect(isAdjacent({ row: 1, col: 1 }, { row: 2, col: 2 })).toBe(false);
    expect(isAdjacent({ row: 1, col: 1 }, { row: 1, col: 1 })).toBe(false);
    expect(isAdjacent({ row: 1, col: 1 }, { row: 1, col: 3 })).toBe(false);
  });

  it("교환은 새 보드를 돌려주고 입력을 변경하지 않는다", () => {
    const board = parse(["01", "23"]);
    const copy = cloneBoard(board);
    expect(swapCells(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toEqual(parse(["10", "23"]));
    expect(board).toEqual(copy);
  });
});

describe("findRuns / findMatches", () => {
  it("매치가 없으면 빈 배열", () => {
    expect(findMatches(parse(["012", "120", "201"]))).toEqual([]);
    expect(hasMatch(parse(["001", "110", "001"]))).toBe(false);
  });

  it("가로 3개", () => {
    const groups = findMatches(parse(["000", "123", "231"]));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe(0);
    expect(groups[0]!.cells).toHaveLength(3);
    expect(groups[0]!.runs[0]!.direction).toBe("row");
  });

  it("세로 3개", () => {
    const groups = findMatches(parse(["412", "423", "431"]));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe(4);
    expect(groups[0]!.runs[0]!.direction).toBe("col");
    expect(groups[0]!.cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ]);
  });

  it("4개, 5개 연속은 한 줄로 인식된다", () => {
    expect(findRuns(parse(["11112"]))[0]!.cells).toHaveLength(4);
    expect(findRuns(parse(["2222203"]))[0]!.cells).toHaveLength(5);
    expect(findRuns(parse(["2222203"]))).toHaveLength(1);
  });

  it("L자: 가로·세로 줄이 모서리를 공유하면 하나의 그룹, 교차 셀은 한 번만", () => {
    const groups = findMatches(parse(["333", "301", "312"]));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.runs).toHaveLength(2);
    expect(groups[0]!.cells).toHaveLength(5);
  });

  it("T자·+자 교차도 하나의 그룹", () => {
    const t = findMatches(parse(["555", "150", "251"]));
    expect(t).toHaveLength(1);
    expect(t[0]!.cells).toHaveLength(5);
    const plus = findMatches(parse(["0102", "1110", "2132"]));
    expect(plus).toHaveLength(1);
    expect(plus[0]!.cells).toHaveLength(5);
  });

  it("떨어진 두 매치는 별도 그룹", () => {
    const groups = findMatches(parse(["0001", "2345", "1111"]));
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.cells.length).sort()).toEqual([3, 4]);
  });

  it("빈 칸은 매치로 보지 않는다", () => {
    expect(hasMatch(parse(["...", "012", "120"]))).toBe(false);
  });
});

describe("점수", () => {
  it("3개 = 블록당 점수", () => {
    expect(scoreGroups(findMatches(parse(["000", "123"])))).toBe(3 * SCORE.perBlock);
  });

  it("4개, 5개 매치 가산점", () => {
    expect(scoreGroups(findMatches(parse(["0000"])))).toBe(4 * SCORE.perBlock + SCORE.run4Bonus);
    expect(scoreGroups(findMatches(parse(["00000"])))).toBe(5 * SCORE.perBlock + SCORE.run5Bonus);
  });

  it("L/T자 교차 가산점", () => {
    expect(scoreGroups(findMatches(parse(["333", "301", "312"])))).toBe(5 * SCORE.perBlock + SCORE.crossBonus);
  });

  it("연쇄 단계만큼 배율이 붙는다", () => {
    const groups = findMatches(parse(["000", "123"]));
    expect(scoreStep(groups, 1)).toBe(30);
    expect(scoreStep(groups, 2)).toBe(60);
    expect(scoreStep(groups, 3)).toBe(90);
  });
});

describe("교환 유효성", () => {
  // 0행 0 1 0 0: (0,0)과 (0,1)을 바꾸면 1 0 0 0 → 가로 3매치
  const board = parse(["0100", "2300", "4512"]);

  it("교환 결과 매치가 생기면 유효 (방향 무관)", () => {
    expect(isValidSwap(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(isValidSwap(board, { row: 0, col: 1 }, { row: 0, col: 0 })).toBe(true);
  });

  it("매치가 생기지 않는 교환은 무효", () => {
    expect(isValidSwap(board, { row: 1, col: 0 }, { row: 2, col: 0 })).toBe(false);
    expect(isValidSwap(parse(["0102", "3450", "1234"]), { row: 0, col: 0 }, { row: 1, col: 0 })).toBe(false);
  });

  it("인접하지 않거나(대각선·먼 칸) 보드 밖이거나 같은 블록끼리면 무효", () => {
    expect(isValidSwap(board, { row: 0, col: 1 }, { row: 0, col: 3 })).toBe(false);
    expect(isValidSwap(board, { row: 0, col: 1 }, { row: 1, col: 0 })).toBe(false);
    expect(isValidSwap(board, { row: 0, col: 3 }, { row: 0, col: 4 })).toBe(false);
    expect(isValidSwap(board, { row: 0, col: 2 }, { row: 0, col: 3 })).toBe(false);
  });
});

describe("제거 · 낙하 · 채우기", () => {
  it("removeCells는 지정 셀을 빈 칸으로", () => {
    const board = removeCells(parse(["012", "345"]), [
      { row: 0, col: 1 },
      { row: 1, col: 2 },
    ]);
    expect(board).toEqual(parse(["0.2", "34."]));
  });

  it("applyGravity: 블록이 아래로 떨어지고 빈 칸은 위로, 낙하 거리 기록", () => {
    const { board, fall } = applyGravity(parse(["01", ".2", "3.", ".."]));
    expect(board).toEqual(parse(["..", "..", "01", "32"]));
    expect(fall).toEqual([
      [0, 0],
      [0, 0],
      [2, 2],
      [1, 2],
    ]);
  });

  it("refill: 빈 칸만 채우고, 새 블록 낙하 거리는 열의 빈 칸 수", () => {
    const rng = sequenceRng([kindValue(5), kindValue(4), kindValue(3)]);
    const { board, fall } = refill(parse(["..", ".1", "02"]), rng);
    // 위→아래, 왼쪽 열부터: (0,0)=5, (1,0)=4, (0,1)=3
    expect(board).toEqual(parse(["53", "41", "02"]));
    expect(fall).toEqual([
      [2, 1],
      [2, 0],
      [0, 0],
    ]);
  });

  it("refill 결과는 항상 0 ~ kinds-1", () => {
    const rng = sequenceRng([0, 0.999999, 0.5]);
    const { board } = refill(parse(["...", "..."]), rng);
    for (const v of board.flat()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(BLOCK_KINDS);
    }
  });
});

describe("연쇄", () => {
  it("resolveStep: 매치 없으면 null", () => {
    expect(resolveStep(parse(["012", "120"]), createRng(1), 1)).toBeNull();
  });

  it("resolveStep: 제거 → 낙하 → 채우기, 점수와 낙하 정보", () => {
    // 1행의 0 3개가 제거되고 위의 1 2 3이 한 칸씩 떨어진 뒤 맨 위가 새 블록으로 채워진다
    const board = parse(["123", "000", "234"]);
    const rng = sequenceRng([kindValue(4), kindValue(5), kindValue(4)]);
    const step = resolveStep(board, rng, 1)!;
    expect(step.cleared).toHaveLength(3);
    expect(step.points).toBe(30);
    expect(step.board).toEqual(parse(["454", "123", "234"]));
    expect(step.fall).toEqual([
      [1, 1, 1],
      [1, 1, 1],
      [0, 0, 0],
    ]);
  });

  it("resolveAll: 새로 생긴 매치는 연쇄로 제거되고 단계마다 배율이 오른다", () => {
    // 0행 0 0 0 제거 → 위에서 채워진 1 1 1이 그대로 다시 매치(2연쇄) → 이후 2 3 4로 채워져 종료
    const board = parse(["000", "235", "352"]);
    const rng = sequenceRng([
      kindValue(1),
      kindValue(1),
      kindValue(1),
      kindValue(2),
      kindValue(3),
      kindValue(4),
    ]);
    const result = resolveAll(board, rng);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.chain).toBe(1);
    expect(result.steps[0]!.points).toBe(30);
    expect(result.steps[1]!.chain).toBe(2);
    expect(result.steps[1]!.points).toBe(60);
    expect(result.points).toBe(90);
    expect(result.board).toEqual(parse(["234", "235", "352"]));
    expect(hasMatch(result.board)).toBe(false);
  });

  it("실제 보드에서 유효한 수를 두면 연쇄 후 매치가 남지 않는다", () => {
    const rng = createRng(123);
    let board = createBoard(rng);
    for (let turn = 0; turn < 30; turn++) {
      const move = findPossibleMove(board)!;
      expect(move).not.toBeNull();
      const result = resolveAll(swapCells(board, move.a, move.b), rng);
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
      expect(result.points).toBeGreaterThan(0);
      expect(hasMatch(result.board)).toBe(false);
      board = ensurePlayable(result.board, rng).board;
      expect(isPlayable(board)).toBe(true);
    }
  });
});

describe("힌트 (가능한 수 탐색)", () => {
  // 유일한 수: (0,2)와 (0,3)을 바꾸면 0 0 0 1
  const board = parse(["0010", "2345"]);

  it("가능한 수를 찾고, 그 수는 실제로 유효하다", () => {
    const move = findPossibleMove(board);
    expect(move).toEqual({ a: { row: 0, col: 2 }, b: { row: 0, col: 3 } });
    expect(isValidSwap(board, move!.a, move!.b)).toBe(true);
  });

  it("findAllMoves는 모든 유효한 수를 찾는다", () => {
    expect(findAllMoves(board)).toEqual([{ a: { row: 0, col: 2 }, b: { row: 0, col: 3 } }]);
    const real = createBoard(createRng(3));
    const moves = findAllMoves(real);
    expect(moves.length).toBeGreaterThanOrEqual(1);
    for (const m of moves) expect(isValidSwap(real, m.a, m.b)).toBe(true);
  });

  it("가능한 수가 없으면 null", () => {
    expect(findPossibleMove(DEAD_BOARD)).toBeNull();
    expect(findAllMoves(DEAD_BOARD)).toEqual([]);
  });
});

describe("데드보드 자동 섞기", () => {
  it("DEAD_BOARD는 매치도 수도 없다 (테스트 전제)", () => {
    expect(hasMatch(DEAD_BOARD)).toBe(false);
    expect(isPlayable(DEAD_BOARD)).toBe(false);
  });

  it("shuffleBoard: 결과는 3매치 없음 + 가능한 수 1개 이상, 같은 블록 구성 유지", () => {
    for (let seed = 0; seed < 30; seed++) {
      const shuffled = shuffleBoard(DEAD_BOARD, createRng(seed));
      expect(isPlayable(shuffled)).toBe(true);
      expect([...shuffled.flat()].sort()).toEqual([...DEAD_BOARD.flat()].sort());
    }
  });

  it("shuffleBoard: 입력을 변경하지 않는다", () => {
    const copy = cloneBoard(DEAD_BOARD);
    shuffleBoard(DEAD_BOARD, createRng(1));
    expect(DEAD_BOARD).toEqual(copy);
  });

  it("같은 블록 구성으로 불가능하면 새 보드를 만든다", () => {
    const allSame: Board = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 2));
    const result = shuffleBoard(allSame, createRng(5));
    expect(isPlayable(result)).toBe(true);
  });

  it("ensurePlayable: 수가 있으면 그대로, 없으면 섞는다", () => {
    const board = createBoard(createRng(9));
    const kept = ensurePlayable(board, createRng(1));
    expect(kept.shuffled).toBe(false);
    expect(kept.board).toBe(board);

    const fixed = ensurePlayable(DEAD_BOARD, createRng(1));
    expect(fixed.shuffled).toBe(true);
    expect(isPlayable(fixed.board)).toBe(true);
  });
});
