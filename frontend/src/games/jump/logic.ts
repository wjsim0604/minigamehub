/**
 * 점프 게임 순수 로직 (UI·canvas와 분리, FR-004).
 *
 * 좌표계: 논리 해상도 WORLD.width x WORLD.height. 가로 x는 왼쪽이 0,
 * 세로는 "지면으로부터의 높이"(위쪽이 +)로 계산하고 그릴 때만 canvas 좌표로 변환한다.
 *
 * 시간: 모든 이동은 경과 시간(초) 기준. 프레임 간격(dt)을 고정 간격(FIXED_STEP)으로 쪼개어
 * 시뮬레이션하므로 60Hz/120Hz/프레임 저하와 관계없이 같은 시간에 같은 거리를 이동한다.
 *
 * 난수: 상태 안의 시드(rngState)로 만드는 결정적 난수를 사용해 함수가 순수하도록 유지한다.
 */

export const WORLD = { width: 600, height: 200, groundY: 170 } as const;
export const PLAYER = { x: 60, width: 28, height: 40 } as const;
/** 중력(px/s²)과 점프 초기 속도(px/s) */
export const PHYSICS = { gravity: 2600, jumpVelocity: 820 } as const;
/** 진행 속도(px/s): 초기값, 가속도(px/s²), 상한 */
export const SPEED = { initial: 320, acceleration: 10, max: 720 } as const;
export const OBSTACLE = { minWidth: 16, maxWidth: 36, minHeight: 26, maxHeight: 52 } as const;
/** 보이는 그래픽보다 작은 히트박스 (각 변에서 안쪽으로 줄이는 px) */
export const HITBOX_INSET = { player: 5, obstacle: 3 } as const;
/** 착지 후 다음 점프까지 보장하는 반응 시간(초) */
export const REACTION_TIME = 0.3;
/** 시뮬레이션 고정 간격(초) */
export const FIXED_STEP = 1 / 240;
/** 한 프레임에서 처리할 최대 경과 시간(초). 이보다 긴 정지는 일시정지로 보고 잘라낸다. */
export const MAX_FRAME_DT = 0.25;
/** 게임오버 직후 입력 무시 시간(ms) */
export const RESTART_DELAY_MS = 500;
/** 점수 = 이동 거리 / DISTANCE_PER_POINT */
export const DISTANCE_PER_POINT = 10;
/** 시작 직후 첫 장애물이 나타나기까지의 여유 거리 */
export const FIRST_OBSTACLE_OFFSET = 240;

export type JumpStatus = "ready" | "running" | "paused" | "over";

export interface Obstacle {
  /** 왼쪽 끝 x */
  x: number;
  width: number;
  height: number;
}

export interface JumpState {
  status: JumpStatus;
  /** 캐릭터 발 높이 (지면 = 0) */
  playerY: number;
  /** 캐릭터 세로 속도 (위쪽 +) */
  playerVy: number;
  /** 현재 진행 속도 (px/s) */
  speed: number;
  /** 누적 이동 거리 (px) */
  distance: number;
  /** 진행(running) 상태로 경과한 시간 (초) */
  elapsed: number;
  obstacles: Obstacle[];
  /** 다음 장애물의 왼쪽 끝이 놓일 x (월드와 함께 왼쪽으로 이동) */
  nextSpawnX: number;
  /** 아직 시뮬레이션하지 않은 남은 시간 (초) */
  accumulator: number;
  /** 결정적 난수 상태 */
  rngState: number;
  /** 게임오버 시각 (ms, performance.now 기준) */
  overAtMs: number | null;
}

// ---------------------------------------------------------------------------
// 난수 (mulberry32)
// ---------------------------------------------------------------------------

export function nextRandom(rngState: number): [value: number, nextState: number] {
  const nextState = (rngState + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextState];
}

// ---------------------------------------------------------------------------
// 파생 값
// ---------------------------------------------------------------------------

/** 점프 체공 시간 (초) */
export const AIR_TIME = (2 * PHYSICS.jumpVelocity) / PHYSICS.gravity;
/** 최대 점프 높이 */
export const MAX_JUMP_HEIGHT = (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity);

/**
 * 주어진 속도에서 보장하는 장애물 사이 최소 간격.
 * 앞 장애물을 넘고 착지한 뒤에도 반응 시간만큼 여유가 남도록 한다.
 */
export function minGapForSpeed(speed: number): number {
  return speed * (AIR_TIME + REACTION_TIME) + PLAYER.width + OBSTACLE.maxWidth;
}

export function scoreOf(state: Pick<JumpState, "distance">): number {
  return Math.floor(state.distance / DISTANCE_PER_POINT);
}

export function isGrounded(state: Pick<JumpState, "playerY" | "playerVy">): boolean {
  return state.playerY <= 0 && state.playerVy <= 0;
}

// ---------------------------------------------------------------------------
// 생성/입력
// ---------------------------------------------------------------------------

export function createInitialState(seed: number): JumpState {
  return {
    status: "ready",
    playerY: 0,
    playerVy: 0,
    speed: SPEED.initial,
    distance: 0,
    elapsed: 0,
    obstacles: [],
    nextSpawnX: WORLD.width + FIRST_OBSTACLE_OFFSET,
    accumulator: 0,
    rngState: seed >>> 0,
    overAtMs: null,
  };
}

/** 땅에 있을 때만 점프 (공중 점프 불가) */
export function jump(state: JumpState): JumpState {
  if (state.status !== "running" || !isGrounded(state)) return state;
  return { ...state, playerVy: PHYSICS.jumpVelocity };
}

/**
 * 점프 입력(스페이스, ↑, 탭) 처리.
 * - ready: 시작 / running: 점프 / paused: 재개 / over: 입력 무시 시간 이후 재시작
 */
export function pressAction(state: JumpState, nowMs: number): JumpState {
  switch (state.status) {
    case "ready":
      return { ...state, status: "running", accumulator: 0 };
    case "running":
      return jump(state);
    case "paused":
      // 재개 입력은 점프로 쓰지 않음. 쌓여 있던 시간은 버린다.
      return { ...state, status: "running", accumulator: 0 };
    case "over":
      if (!canRestart(state, nowMs)) return state;
      return restart(state);
  }
}

export function canRestart(state: JumpState, nowMs: number): boolean {
  return state.status === "over" && (state.overAtMs === null || nowMs - state.overAtMs >= RESTART_DELAY_MS);
}

/** 점수 0, 초기 속도로 즉시 다시 시작 */
export function restart(state: JumpState): JumpState {
  return { ...createInitialState(state.rngState), status: "running" };
}

/** 진행 중일 때만 일시정지 (FR-006) */
export function pause(state: JumpState): JumpState {
  if (state.status !== "running") return state;
  return { ...state, status: "paused", accumulator: 0 };
}

// ---------------------------------------------------------------------------
// 충돌
// ---------------------------------------------------------------------------

export interface Box {
  left: number;
  right: number;
  /** 지면 기준 아래 끝 높이 */
  bottom: number;
  /** 지면 기준 위 끝 높이 */
  top: number;
}

export function playerHitbox(playerY: number): Box {
  const inset = HITBOX_INSET.player;
  return {
    left: PLAYER.x + inset,
    right: PLAYER.x + PLAYER.width - inset,
    bottom: playerY + inset,
    top: playerY + PLAYER.height - inset,
  };
}

export function obstacleHitbox(obstacle: Obstacle): Box {
  const inset = HITBOX_INSET.obstacle;
  return {
    left: obstacle.x + inset,
    right: obstacle.x + obstacle.width - inset,
    bottom: 0,
    top: obstacle.height - inset,
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

export function collides(playerY: number, obstacles: readonly Obstacle[]): boolean {
  const player = playerHitbox(playerY);
  return obstacles.some((obstacle) => boxesOverlap(player, obstacleHitbox(obstacle)));
}

// ---------------------------------------------------------------------------
// 스폰
// ---------------------------------------------------------------------------

/**
 * 오른쪽 화면 밖에서 대기 중인 장애물을 필요한 만큼 생성한다.
 * 다음 장애물 위치는 "직전 장애물 오른쪽 끝 + 간격"이며, 간격은 항상 minGapForSpeed 이상이다.
 */
export function spawnObstacles(
  obstacles: readonly Obstacle[],
  nextSpawnX: number,
  speed: number,
  rngState: number,
): { obstacles: Obstacle[]; nextSpawnX: number; rngState: number } {
  const result = [...obstacles];
  let spawnX = nextSpawnX;
  let rng = rngState;
  while (spawnX <= WORLD.width) {
    let r: number;
    [r, rng] = nextRandom(rng);
    const width = OBSTACLE.minWidth + r * (OBSTACLE.maxWidth - OBSTACLE.minWidth);
    [r, rng] = nextRandom(rng);
    const height = OBSTACLE.minHeight + r * (OBSTACLE.maxHeight - OBSTACLE.minHeight);
    [r, rng] = nextRandom(rng);
    // 장애물이 캐릭터에 도달할 때는 속도가 조금 더 올라가 있으므로 여유를 둔다
    const speedAtArrival = Math.min(SPEED.max, speed + SPEED.acceleration * 3);
    const minGap = minGapForSpeed(speedAtArrival);
    const gap = minGap + r * minGap * 0.8;
    const obstacle: Obstacle = { x: spawnX, width, height };
    result.push(obstacle);
    spawnX = obstacle.x + obstacle.width + gap;
  }
  return { obstacles: result, nextSpawnX: spawnX, rngState: rng };
}

// ---------------------------------------------------------------------------
// 시뮬레이션
// ---------------------------------------------------------------------------

/** 고정 간격 h(초)만큼 한 단계 진행 */
export function stepFixed(state: JumpState, h: number): JumpState {
  // 캐릭터 (등가속도 운동의 정확한 적분)
  let playerY = state.playerY + state.playerVy * h - 0.5 * PHYSICS.gravity * h * h;
  let playerVy = state.playerVy - PHYSICS.gravity * h;
  if (playerY <= 0) {
    playerY = 0;
    playerVy = 0;
  }

  // 속도 점증 (상한)
  const speed = Math.min(SPEED.max, state.speed + SPEED.acceleration * h);
  const dx = speed * h;

  const moved = state.obstacles.map((o) => ({ ...o, x: o.x - dx })).filter((o) => o.x + o.width > 0);
  const spawned = spawnObstacles(moved, state.nextSpawnX - dx, speed, state.rngState);

  return {
    ...state,
    playerY,
    playerVy,
    speed,
    distance: state.distance + dx,
    elapsed: state.elapsed + h,
    obstacles: spawned.obstacles,
    nextSpawnX: spawned.nextSpawnX,
    rngState: spawned.rngState,
  };
}

/**
 * 프레임 간 경과 시간 dt(초)만큼 게임을 진행한다. 진행(running) 상태가 아니면 아무것도 하지 않는다.
 * 충돌하면 즉시 over 상태가 되고 그 시점에서 멈춘다.
 */
export function advance(state: JumpState, dt: number, nowMs: number): JumpState {
  if (state.status !== "running") return state;
  const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_FRAME_DT) : 0;
  let next: JumpState = { ...state, accumulator: state.accumulator + safeDt };
  // 부동소수 오차로 마지막 단계가 누락되지 않도록 아주 작은 여유를 둔다
  const epsilon = 1e-9;
  while (next.accumulator + epsilon >= FIXED_STEP) {
    next = stepFixed(next, FIXED_STEP);
    next.accumulator -= FIXED_STEP;
    if (collides(next.playerY, next.obstacles)) {
      return { ...next, status: "over", accumulator: 0, overAtMs: nowMs };
    }
  }
  return next;
}
