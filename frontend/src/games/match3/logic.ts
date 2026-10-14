/**
 * 블록 팡(3매치 퍼즐) 순수 로직 (UI와 분리, FR-007).
 * 모든 함수는 입력 보드를 변경하지 않고 새 값을 반환한다.
 * 난수는 `Rng`로 주입해 테스트에서 결정적으로 재현할 수 있다.
 */

export const BOARD_SIZE = 7;
/** 블록 종류 수 (색 + 모양으로 구분) */
export const BLOCK_KINDS = 6;
/** 제한 시간 (ms) */
export const TIME_LIMIT_MS = 60_000;
/** 매치로 인정되는 최소 연속 블록 수 */
export const MIN_MATCH = 3;

/** 점수 규칙 */
export const SCORE = {
  /** 제거한 블록 1개당 */
  perBlock: 10,
  /** 4개 연속 매치 1줄당 가산점 */
  run4Bonus: 20,
  /** 5개 이상 연속 매치 1줄당 가산점 */
  run5Bonus: 50,
  /** 가로·세로가 교차하는(L/T/+자) 매치 그룹당 가산점 */
  crossBonus: 30,
} as const;

/** 빈 칸 (제거 직후 ~ 채우기 전에만 존재) */
export const EMPTY = -1;

/** 블록 종류(0 ~ kinds-1) 또는 EMPTY */
export type Board = number[][];

export interface Pos {
  row: number;
  col: number;
}

export interface Move {
  a: Pos;
  b: Pos;
}

/** 한 방향으로 이어진 같은 블록 줄 (길이 3 이상) */
export interface Run {
  kind: number;
  direction: "row" | "col";
  cells: Pos[];
}

/** 셀을 공유하는 줄끼리 묶은 매치 그룹 (L/T자 교차는 하나의 그룹) */
export interface MatchGroup {
  kind: number;
  /** 그룹에 속한 셀 (교차 셀은 한 번만) */
  cells: Pos[];
  runs: Run[];
}

/** 연쇄 한 단계의 결과 */
export interface CascadeStep {
  /** 연쇄 단계 (1부터) */
  chain: number;
  groups: MatchGroup[];
  /** 이번 단계에서 제거된 셀 */
  cleared: Pos[];
  /** 이번 단계에서 얻은 점수 (연쇄 배율 적용) */
  points: number;
  /** 제거 → 낙하 → 채우기 후의 보드 */
  board: Board;
  /** 최종 보드의 각 셀이 몇 칸 떨어졌는지 (새 블록은 보드 위에서 떨어진 것으로 계산) */
  fall: number[][];
}

// ---------------------------------------------------------------------------
// 난수
// ---------------------------------------------------------------------------

/** [0, 1) 난수 생성기 */
export type Rng = () => number;

/** 시드 기반 결정적 난수 생성기 (mulberry32) */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(rng() * n)));
}

// ---------------------------------------------------------------------------
// 기본 유틸
// ---------------------------------------------------------------------------

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function getCell(board: Board, pos: Pos): number {
  return board[pos.row]?.[pos.col] ?? EMPTY;
}

export function inBounds(board: Board, pos: Pos): boolean {
  return pos.row >= 0 && pos.row < board.length && pos.col >= 0 && pos.col < (board[0]?.length ?? 0);
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

/** 상하좌우로 인접한지 */
export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function posKey(pos: Pos): string {
  return `${pos.row},${pos.col}`;
}

/** 두 셀을 교환한 새 보드 */
export function swapCells(board: Board, a: Pos, b: Pos): Board {
  const next = cloneBoard(board);
  const va = getCell(board, a);
  const vb = getCell(board, b);
  next[a.row]![a.col] = vb;
  next[b.row]![b.col] = va;
  return next;
}

// ---------------------------------------------------------------------------
// 매치 탐색
// ---------------------------------------------------------------------------

/** 가로·세로로 3개 이상 이어진 같은 블록 줄을 모두 찾는다 */
export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  for (let r = 0; r < rows; r++) {
    let start = 0;
    for (let c = 1; c <= cols; c++) {
      const kind = getCell(board, { row: r, col: start });
      if (c < cols && getCell(board, { row: r, col: c }) === kind) continue;
      if (kind !== EMPTY && c - start >= MIN_MATCH) {
        runs.push({
          kind,
          direction: "row",
          cells: Array.from({ length: c - start }, (_, i) => ({ row: r, col: start + i })),
        });
      }
      start = c;
    }
  }

  for (let c = 0; c < cols; c++) {
    let start = 0;
    for (let r = 1; r <= rows; r++) {
      const kind = getCell(board, { row: start, col: c });
      if (r < rows && getCell(board, { row: r, col: c }) === kind) continue;
      if (kind !== EMPTY && r - start >= MIN_MATCH) {
        runs.push({
          kind,
          direction: "col",
          cells: Array.from({ length: r - start }, (_, i) => ({ row: start + i, col: c })),
        });
      }
      start = r;
    }
  }

  return runs;
}

/** 매치 그룹을 찾는다. 셀을 공유하는 줄(L/T/+자 교차)은 하나의 그룹으로 묶는다. */
export function findMatches(board: Board): MatchGroup[] {
  const runs = findRuns(board);
  // union-find (줄 단위)
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const owner = new Map<string, number>();
  runs.forEach((run, i) => {
    for (const cell of run.cells) {
      const key = posKey(cell);
      const other = owner.get(key);
      if (other === undefined) owner.set(key, i);
      else parent[find(i)] = find(other);
    }
  });

  const byRoot = new Map<number, MatchGroup>();
  runs.forEach((run, i) => {
    const root = find(i);
    let group = byRoot.get(root);
    if (!group) {
      group = { kind: run.kind, cells: [], runs: [] };
      byRoot.set(root, group);
    }
    group.runs.push(run);
  });

  const groups = [...byRoot.values()];
  for (const group of groups) {
    const seen = new Set<string>();
    for (const run of group.runs) {
      for (const cell of run.cells) {
        const key = posKey(cell);
        if (seen.has(key)) continue;
        seen.add(key);
        group.cells.push(cell);
      }
    }
  }
  return groups;
}

export function hasMatch(board: Board): boolean {
  return findRuns(board).length > 0;
}

/** 매치 그룹들의 점수 (연쇄 배율 적용 전) */
export function scoreGroups(groups: readonly MatchGroup[]): number {
  let points = 0;
  for (const group of groups) {
    points += group.cells.length * SCORE.perBlock;
    for (const run of group.runs) {
      if (run.cells.length >= 5) points += SCORE.run5Bonus;
      else if (run.cells.length === 4) points += SCORE.run4Bonus;
    }
    const hasRow = group.runs.some((run) => run.direction === "row");
    const hasCol = group.runs.some((run) => run.direction === "col");
    if (hasRow && hasCol) points += SCORE.crossBonus;
  }
  return points;
}

/** 연쇄 단계 점수: 기본 점수 × 연쇄 단계(1, 2, 3, ...) */
export function scoreStep(groups: readonly MatchGroup[], chain: number): number {
  return scoreGroups(groups) * Math.max(1, chain);
}

// ---------------------------------------------------------------------------
// 교환
// ---------------------------------------------------------------------------

/** 교환이 유효한지: 보드 안, 인접, 교환 결과 매치가 생김 */
export function isValidSwap(board: Board, a: Pos, b: Pos): boolean {
  if (!inBounds(board, a) || !inBounds(board, b) || !isAdjacent(a, b)) return false;
  if (getCell(board, a) === getCell(board, b)) return false;
  return hasMatch(swapCells(board, a, b));
}

/** 가능한 교환을 모두 찾는다 (각 교환은 위→아래, 왼쪽→오른쪽 방향으로 한 번씩) */
export function findAllMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const a = { row: r, col: c };
      for (const b of [
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
      ]) {
        if (isValidSwap(board, a, b)) moves.push({ a, b });
      }
    }
  }
  return moves;
}

/** 가능한 교환 하나 (힌트용). 없으면 null */
export function findPossibleMove(board: Board): Move | null {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const a = { row: r, col: c };
      for (const b of [
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
      ]) {
        if (isValidSwap(board, a, b)) return { a, b };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 제거 · 낙하 · 채우기
// ---------------------------------------------------------------------------

export function removeCells(board: Board, cells: readonly Pos[]): Board {
  const next = cloneBoard(board);
  for (const cell of cells) {
    if (inBounds(next, cell)) next[cell.row]![cell.col] = EMPTY;
  }
  return next;
}

/**
 * 빈 칸 위의 블록을 아래로 떨어뜨린다. 빈 칸은 각 열의 위쪽에 모인다.
 * fall: 결과 보드의 각 셀이 몇 칸 떨어졌는지 (빈 칸은 0)
 */
export function applyGravity(board: Board): { board: Board; fall: number[][] } {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const next: Board = Array.from({ length: rows }, () => Array.from({ length: cols }, () => EMPTY));
  const fall: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const kind = getCell(board, { row: r, col: c });
      if (kind === EMPTY) continue;
      next[write]![c] = kind;
      fall[write]![c] = write - r;
      write--;
    }
  }
  return { board: next, fall };
}

/**
 * 빈 칸을 새 블록으로 채운다 (위에서 아래 순서로 난수 사용).
 * fall: 새 블록은 해당 열의 빈 칸 수만큼 보드 위에서 떨어진 것으로 기록 (기존 셀은 0)
 */
export function refill(board: Board, rng: Rng, kinds: number = BLOCK_KINDS): { board: Board; fall: number[][] } {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const next = cloneBoard(board);
  const fall: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let c = 0; c < cols; c++) {
    let empties = 0;
    for (let r = 0; r < rows; r++) if (getCell(board, { row: r, col: c }) === EMPTY) empties++;
    for (let r = 0; r < rows; r++) {
      if (getCell(board, { row: r, col: c }) !== EMPTY) continue;
      next[r]![c] = randomInt(rng, kinds);
      fall[r]![c] = empties;
    }
  }
  return { board: next, fall };
}

/**
 * 연쇄 한 단계: 매치 제거 → 낙하 → 채우기. 매치가 없으면 null.
 */
export function resolveStep(board: Board, rng: Rng, chain: number, kinds: number = BLOCK_KINDS): CascadeStep | null {
  const groups = findMatches(board);
  if (groups.length === 0) return null;
  const cleared = groups.flatMap((group) => group.cells);
  const removed = removeCells(board, cleared);
  const dropped = applyGravity(removed);
  const filled = refill(dropped.board, rng, kinds);
  const fall = dropped.fall.map((row, r) => row.map((d, c) => d + (filled.fall[r]?.[c] ?? 0)));
  return { chain, groups, cleared, points: scoreStep(groups, chain), board: filled.board, fall };
}

/** 매치가 없어질 때까지 연쇄를 모두 처리한다 (애니메이션 없이 결과만 필요할 때) */
export function resolveAll(
  board: Board,
  rng: Rng,
  kinds: number = BLOCK_KINDS,
): { board: Board; steps: CascadeStep[]; points: number } {
  const steps: CascadeStep[] = [];
  let current = board;
  for (let chain = 1; ; chain++) {
    const step = resolveStep(current, rng, chain, kinds);
    if (!step) break;
    steps.push(step);
    current = step.board;
  }
  return { board: current, steps, points: steps.reduce((sum, step) => sum + step.points, 0) };
}

// ---------------------------------------------------------------------------
// 보드 생성 · 섞기
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 1000;

/** 3매치가 없도록 무작위로 채운 보드 (가능한 수 보장 없음) */
function fillWithoutMatches(rng: Rng, size: number, kinds: number): Board {
  const board: Board = Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const banned = new Set<number>();
      const left1 = getCell(board, { row: r, col: c - 1 });
      if (left1 !== EMPTY && left1 === getCell(board, { row: r, col: c - 2 })) banned.add(left1);
      const up1 = getCell(board, { row: r - 1, col: c });
      if (up1 !== EMPTY && up1 === getCell(board, { row: r - 2, col: c })) banned.add(up1);
      const candidates = Array.from({ length: kinds }, (_, k) => k).filter((k) => !banned.has(k));
      board[r]![c] = candidates[randomInt(rng, candidates.length)]!;
    }
  }
  return board;
}

/** 플레이 가능한 보드인지: 3매치 없음 + 가능한 수 1개 이상 */
export function isPlayable(board: Board): boolean {
  return !hasMatch(board) && findPossibleMove(board) !== null;
}

/** 새 보드: 시작 시 3매치가 없고 가능한 수가 1개 이상이다 */
export function createBoard(rng: Rng, size: number = BOARD_SIZE, kinds: number = BLOCK_KINDS): Board {
  if (kinds < 3) throw new Error("블록 종류는 3가지 이상이어야 합니다");
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = fillWithoutMatches(rng, size, kinds);
    if (findPossibleMove(board) !== null) return board;
  }
  throw new Error("플레이 가능한 보드를 만들지 못했습니다");
}

/**
 * 보드의 블록을 섞는다. 결과도 3매치가 없고 가능한 수가 1개 이상이다.
 * 기존 블록 구성으로 만들 수 없으면(일정 횟수 실패) 새 보드를 만든다.
 */
export function shuffleBoard(board: Board, rng: Rng, kinds: number = BLOCK_KINDS): Board {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const blocks = board.flat();
  for (let attempt = 0; attempt < 100; attempt++) {
    const pool = [...blocks];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randomInt(rng, i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const next: Board = Array.from({ length: rows }, (_, r) => pool.slice(r * cols, (r + 1) * cols));
    if (isPlayable(next)) return next;
  }
  return createBoard(rng, rows, kinds);
}

/** 가능한 수가 없으면 섞는다 (데드보드 처리) */
export function ensurePlayable(board: Board, rng: Rng, kinds: number = BLOCK_KINDS): { board: Board; shuffled: boolean } {
  if (findPossibleMove(board) !== null) return { board, shuffled: false };
  return { board: shuffleBoard(board, rng, kinds), shuffled: true };
}
