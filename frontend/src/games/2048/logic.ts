/**
 * 2048 게임 순수 로직 (UI와 분리, FR-003).
 * 모든 함수는 입력을 변경하지 않고 새 값을 반환한다. 난수는 외부에서 주입한다.
 */

export const BOARD_SIZE = 4;
export const WIN_TILE = 2048;
/** 새 타일이 4일 확률 (나머지는 2) */
export const FOUR_PROBABILITY = 0.1;

/** 0은 빈 칸 */
export type Board = number[][];
export type Direction = "up" | "down" | "left" | "right";

export interface MoveResult {
  board: Board;
  /** 이번 이동으로 얻은 점수 (합쳐진 결과 값의 합) */
  gained: number;
  /** 보드에 변화가 있었는지 */
  moved: boolean;
}

export function createEmptyBoard(size: number = BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/**
 * 한 줄을 왼쪽으로 민다. 한 번의 이동에서 한 타일은 최대 1번만 합쳐진다.
 * 예: [2,2,2,2] -> [4,4,0,0], [4,4,8,0] -> [8,8,0,0]
 */
export function slideRowLeft(row: readonly number[]): { row: number[]; gained: number } {
  const tiles = row.filter((value) => value !== 0);
  const result: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    const current = tiles[i] as number;
    const next = tiles[i + 1];
    if (next !== undefined && next === current) {
      const merged = current * 2;
      result.push(merged);
      gained += merged;
      i++; // 합쳐진 타일은 이번 이동에서 다시 합쳐지지 않음
    } else {
      result.push(current);
    }
  }
  while (result.length < row.length) result.push(0);
  return { row: result, gained };
}

function transpose(board: Board): Board {
  return board[0]!.map((_, col) => board.map((row) => row[col] as number));
}

function reverseRows(board: Board): Board {
  return board.map((row) => [...row].reverse());
}

export function boardsEqual(a: Board, b: Board): boolean {
  return a.length === b.length && a.every((row, r) => row.length === b[r]!.length && row.every((v, c) => v === b[r]![c]));
}

/** 보드를 주어진 방향으로 이동한다. 새 타일은 추가하지 않는다. */
export function move(board: Board, direction: Direction): MoveResult {
  // 모든 방향을 "왼쪽으로 밀기"로 변환해 처리한 뒤 되돌린다
  let working: Board;
  switch (direction) {
    case "left":
      working = cloneBoard(board);
      break;
    case "right":
      working = reverseRows(board);
      break;
    case "up":
      working = transpose(board);
      break;
    case "down":
      working = reverseRows(transpose(board));
      break;
  }

  let gained = 0;
  const slid = working.map((row) => {
    const result = slideRowLeft(row);
    gained += result.gained;
    return result.row;
  });

  let next: Board;
  switch (direction) {
    case "left":
      next = slid;
      break;
    case "right":
      next = reverseRows(slid);
      break;
    case "up":
      next = transpose(slid);
      break;
    case "down":
      next = transpose(reverseRows(slid));
      break;
  }

  return { board: next, gained, moved: !boardsEqual(board, next) };
}

export function getEmptyCells(board: Board): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  board.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value === 0) cells.push([r, c]);
    }),
  );
  return cells;
}

/**
 * 빈 칸 하나에 새 타일(2: 90%, 4: 10%)을 추가한다.
 * @param cellRandom 칸 선택용 난수 [0, 1)
 * @param valueRandom 값 선택용 난수 [0, 1)
 */
export function addRandomTile(board: Board, cellRandom: number, valueRandom: number): Board {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;
  const index = Math.min(empty.length - 1, Math.floor(cellRandom * empty.length));
  const [r, c] = empty[index]!;
  const next = cloneBoard(board);
  next[r]![c] = valueRandom < FOUR_PROBABILITY ? 4 : 2;
  return next;
}

/** 이동 가능한 방향이 하나라도 있는지 (빈 칸 또는 인접한 같은 숫자) */
export function canMove(board: Board): boolean {
  for (let r = 0; r < board.length; r++) {
    const row = board[r]!;
    for (let c = 0; c < row.length; c++) {
      const value = row[c]!;
      if (value === 0) return true;
      if (c + 1 < row.length && row[c + 1] === value) return true;
      if (r + 1 < board.length && board[r + 1]![c] === value) return true;
    }
  }
  return false;
}

export function isGameOver(board: Board): boolean {
  return !canMove(board);
}

export function hasTile(board: Board, target: number = WIN_TILE): boolean {
  return board.some((row) => row.some((value) => value >= target));
}

// ---------------------------------------------------------------------------
// 게임 상태 (리듀서). 난수는 액션에 담아 전달해 리듀서를 순수하게 유지한다.
// ---------------------------------------------------------------------------

export type GameStatus = "playing" | "won" | "over";

export interface GameState {
  board: Board;
  score: number;
  status: GameStatus;
  /** 2048 달성 후 "계속하기"를 눌렀는지 (이후에는 성공 안내를 다시 띄우지 않음) */
  keepPlaying: boolean;
  /** 새 게임마다 증가 (게임오버 알림 중복 방지용) */
  gameNumber: number;
}

/** 새 게임 생성에 필요한 난수 4개 (타일 2개 × 칸/값) */
export type NewGameRandoms = readonly [number, number, number, number];
/** 이동 후 새 타일 생성에 필요한 난수 2개 (칸/값) */
export type SpawnRandoms = readonly [number, number];

export type GameAction =
  | { type: "move"; direction: Direction; randoms: SpawnRandoms }
  | { type: "newGame"; randoms: NewGameRandoms }
  | { type: "continue" };

export function createGame(randoms: NewGameRandoms, gameNumber = 0): GameState {
  let board = createEmptyBoard();
  board = addRandomTile(board, randoms[0], randoms[1]);
  board = addRandomTile(board, randoms[2], randoms[3]);
  return { board, score: 0, status: "playing", keepPlaying: false, gameNumber };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "newGame":
      return createGame(action.randoms, state.gameNumber + 1);
    case "continue":
      if (state.status !== "won") return state;
      // 2048을 만든 이동으로 더 이상 움직일 수 없게 되었다면 바로 게임오버
      return { ...state, status: isGameOver(state.board) ? "over" : "playing", keepPlaying: true };
    case "move": {
      // 성공 안내·게임오버 오버레이가 떠 있는 동안에는 입력을 받지 않는다
      if (state.status !== "playing") return state;
      const result = move(state.board, action.direction);
      if (!result.moved) return state; // 변화 없는 입력은 무시
      const board = addRandomTile(result.board, action.randoms[0], action.randoms[1]);
      const score = state.score + result.gained;
      let status: GameStatus = "playing";
      if (!state.keepPlaying && hasTile(board, WIN_TILE)) status = "won";
      else if (isGameOver(board)) status = "over";
      return { ...state, board, score, status };
    }
  }
}
