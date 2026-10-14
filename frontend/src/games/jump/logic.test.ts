import { describe, expect, it } from "vitest";
import {
  AIR_TIME,
  FIXED_STEP,
  HITBOX_INSET,
  MAX_JUMP_HEIGHT,
  OBSTACLE,
  PHYSICS,
  PLAYER,
  RESTART_DELAY_MS,
  SPEED,
  WORLD,
  advance,
  collides,
  createInitialState,
  jump,
  minGapForSpeed,
  nextRandom,
  pause,
  pressAction,
  scoreOf,
  spawnObstacles,
  type JumpState,
} from "./logic";

function running(seed = 1, overrides: Partial<JumpState> = {}): JumpState {
  return { ...createInitialState(seed), status: "running", ...overrides };
}

/** 장애물 없이 진행시키기 위해 첫 장애물을 아주 멀리 둔다 */
function runningWithoutObstacles(overrides: Partial<JumpState> = {}): JumpState {
  return running(1, { nextSpawnX: Number.POSITIVE_INFINITY, ...overrides });
}

function simulate(state: JumpState, seconds: number, fps: number): JumpState {
  let s = state;
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) s = advance(s, 1 / fps, i * (1000 / fps));
  return s;
}

describe("난수", () => {
  it("같은 시드는 같은 수열을 만든다", () => {
    const [a1, s1] = nextRandom(42);
    const [a2] = nextRandom(s1);
    const [b1, t1] = nextRandom(42);
    const [b2] = nextRandom(t1);
    expect([a1, a2]).toEqual([b1, b2]);
    expect(a1).toBeGreaterThanOrEqual(0);
    expect(a1).toBeLessThan(1);
  });
});

describe("상태 전이", () => {
  it("대기 상태에서 첫 입력으로 시작한다", () => {
    const ready = createInitialState(7);
    expect(ready.status).toBe("ready");
    // 대기 중에는 진행하지 않는다
    expect(advance(ready, 0.1, 0)).toBe(ready);
    const started = pressAction(ready, 0);
    expect(started.status).toBe("running");
    expect(started.playerVy).toBe(0);
  });

  it("진행 중 입력은 점프", () => {
    const s = pressAction(running(), 0);
    expect(s.playerVy).toBe(PHYSICS.jumpVelocity);
  });

  it("공중에서는 다시 점프할 수 없다", () => {
    let s = jump(runningWithoutObstacles());
    s = simulate(s, 0.1, 60);
    expect(s.playerY).toBeGreaterThan(0);
    const vyBefore = s.playerVy;
    expect(jump(s).playerVy).toBe(vyBefore);
    expect(pressAction(s, 0)).toBe(s);
  });

  it("착지하면 다시 점프할 수 있다", () => {
    let s = jump(runningWithoutObstacles());
    s = simulate(s, AIR_TIME + 0.05, 60);
    expect(s.playerY).toBe(0);
    expect(jump(s).playerVy).toBe(PHYSICS.jumpVelocity);
  });

  it("최대 점프 높이가 가장 높은 장애물보다 충분히 높다", () => {
    expect(MAX_JUMP_HEIGHT).toBeGreaterThan(OBSTACLE.maxHeight + PLAYER.height / 2);
  });

  it("일시정지 중에는 점수와 속도가 증가하지 않고, 입력 시 재개한다 (FR-006)", () => {
    const s = simulate(runningWithoutObstacles(), 1, 60);
    const paused = pause(s);
    expect(paused.status).toBe("paused");
    const later = simulate(paused, 5, 60);
    expect(later.distance).toBe(paused.distance);
    expect(later.speed).toBe(paused.speed);
    expect(scoreOf(later)).toBe(scoreOf(paused));
    const resumed = pressAction(later, 0);
    expect(resumed.status).toBe("running");
    // 재개 입력은 점프로 쓰이지 않음
    expect(resumed.playerVy).toBe(0);
  });

  it("진행 중이 아니면 pause는 아무것도 하지 않는다", () => {
    const ready = createInitialState(1);
    expect(pause(ready)).toBe(ready);
  });
});

describe("경과 시간 기반 이동", () => {
  it("60Hz, 120Hz, 프레임 저하(10Hz) 모두 같은 시간에 같은 거리를 이동한다", () => {
    const base = runningWithoutObstacles();
    const at60 = simulate(base, 2, 60);
    const at120 = simulate(base, 2, 120);
    const at10 = simulate(base, 2, 10);
    expect(at120.distance).toBeCloseTo(at60.distance, 6);
    expect(at10.distance).toBeCloseTo(at60.distance, 6);
    expect(at120.speed).toBeCloseTo(at60.speed, 6);
  });

  it("거리 = 경과 시간 x 속도 누적", () => {
    const s = simulate(runningWithoutObstacles(), 1, 60);
    // v0*t + a*t²/2
    expect(s.distance).toBeCloseTo(SPEED.initial + SPEED.acceleration / 2, 0);
    expect(s.elapsed).toBeCloseTo(1, 6);
  });

  it("점프 궤적도 주사율과 무관하다", () => {
    const base = jump(runningWithoutObstacles());
    const a = simulate(base, 0.2, 60);
    const b = simulate(base, 0.2, 144);
    expect(b.playerY).toBeCloseTo(a.playerY, 1);
  });

  it("아주 긴 프레임(탭 복귀 등)은 상한으로 잘라 순간이동을 막는다", () => {
    const base = runningWithoutObstacles();
    const s = advance(base, 10, 0);
    expect(s.elapsed).toBeLessThanOrEqual(0.25 + FIXED_STEP);
  });

  it("비정상 dt(NaN, 음수)는 무시한다", () => {
    const base = runningWithoutObstacles();
    expect(advance(base, Number.NaN, 0).distance).toBe(0);
    expect(advance(base, -1, 0).distance).toBe(0);
  });
});

describe("속도", () => {
  it("시간이 지날수록 증가하고 상한을 넘지 않는다", () => {
    const base = runningWithoutObstacles();
    const s10 = simulate(base, 10, 60);
    expect(s10.speed).toBeGreaterThan(SPEED.initial);
    const s300 = simulate(base, 300, 30);
    expect(s300.speed).toBe(SPEED.max);
  });
});

describe("점수", () => {
  it("생존 거리 기반 정수", () => {
    expect(scoreOf({ distance: 0 })).toBe(0);
    expect(scoreOf({ distance: 99.9 })).toBe(9);
    expect(scoreOf({ distance: 100 })).toBe(10);
  });
});

describe("충돌", () => {
  const playerFront = PLAYER.x + PLAYER.width;

  it("겹치면 충돌", () => {
    expect(collides(0, [{ x: PLAYER.x, width: 20, height: 40 }])).toBe(true);
  });

  it("히트박스는 그래픽보다 작다: 가장자리만 살짝 닿으면 충돌이 아니다", () => {
    // 그래픽은 2px 겹치지만 히트박스 여유보다 작음
    const grazing = { x: playerFront - 2, width: 20, height: 40 };
    expect(collides(0, [grazing])).toBe(false);
    // 위에서 살짝 스치는 경우
    const below = { x: PLAYER.x, width: 20, height: 30 };
    expect(collides(30 - HITBOX_INSET.player, [below])).toBe(false);
  });

  it("충분히 높이 떠 있으면 충돌하지 않는다", () => {
    expect(collides(OBSTACLE.maxHeight, [{ x: PLAYER.x, width: 30, height: OBSTACLE.maxHeight }])).toBe(false);
  });

  it("충돌하면 즉시 게임오버, 이후 진행하지 않는다", () => {
    const s = running(1, {
      obstacles: [{ x: playerFront + 1, width: 20, height: 40 }],
      nextSpawnX: Number.POSITIVE_INFINITY,
    });
    const over = simulate(s, 1, 60);
    expect(over.status).toBe("over");
    expect(over.overAtMs).not.toBeNull();
    const frozen = advance(over, 1, 99999);
    expect(frozen).toBe(over);
  });
});

describe("재시작", () => {
  function overAt(ms: number): JumpState {
    return { ...running(3), status: "over", distance: 5000, speed: 600, overAtMs: ms };
  }

  it(`게임오버 후 ${RESTART_DELAY_MS}ms 동안은 입력을 무시한다`, () => {
    const over = overAt(1000);
    expect(pressAction(over, 1000 + RESTART_DELAY_MS - 1)).toBe(over);
  });

  it("입력 무시 시간 이후 입력하면 점수 0, 초기 속도로 재시작한다", () => {
    const restarted = pressAction(overAt(1000), 1000 + RESTART_DELAY_MS);
    expect(restarted.status).toBe("running");
    expect(restarted.distance).toBe(0);
    expect(restarted.speed).toBe(SPEED.initial);
    expect(restarted.obstacles).toEqual([]);
    expect(restarted.overAtMs).toBeNull();
  });
});

describe("장애물 스폰", () => {
  it("오른쪽 화면 끝에서 생성되고 왼쪽으로 이동한다", () => {
    let s = runningWithoutObstacles({ nextSpawnX: WORLD.width });
    s = simulate(s, 1 / 60, 60);
    expect(s.obstacles).toHaveLength(1);
    const firstX = s.obstacles[0]!.x;
    expect(firstX).toBeLessThanOrEqual(WORLD.width);
    s = simulate(s, 0.1, 60);
    expect(s.obstacles[0]!.x).toBeLessThan(firstX);
  });

  it("화면 밖으로 나간 장애물은 제거된다", () => {
    const s = runningWithoutObstacles({ obstacles: [{ x: 0, width: 10, height: 30 }] });
    expect(simulate(s, 0.1, 60).obstacles).toHaveLength(0);
  });

  it("장애물 크기는 정해진 범위 안이다", () => {
    let rng = 123;
    for (let i = 0; i < 200; i++) {
      const result = spawnObstacles([], WORLD.width, SPEED.initial, rng);
      rng = result.rngState;
      const o = result.obstacles[0]!;
      expect(o.width).toBeGreaterThanOrEqual(OBSTACLE.minWidth);
      expect(o.width).toBeLessThanOrEqual(OBSTACLE.maxWidth);
      expect(o.height).toBeGreaterThanOrEqual(OBSTACLE.minHeight);
      expect(o.height).toBeLessThanOrEqual(OBSTACLE.maxHeight);
    }
  });

  it("장애물 사이 간격은 항상 해당 속도의 최소 간격 이상이다", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = running(seed);
      let minObservedRatio = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 60 * 60; i++) {
        // 충돌을 무시하고 스폰 패턴만 관찰하기 위해 캐릭터를 높이 띄워 둔다
        s = advance({ ...s, playerY: 1000, playerVy: 0 }, 1 / 60, 0);
        for (let k = 1; k < s.obstacles.length; k++) {
          const prev = s.obstacles[k - 1]!;
          const cur = s.obstacles[k]!;
          const gap = cur.x - (prev.x + prev.width);
          minObservedRatio = Math.min(minObservedRatio, gap / minGapForSpeed(s.speed));
        }
      }
      expect(s.status).toBe("running");
      expect(minObservedRatio).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("규칙대로 점프하는 플레이어는 상한 속도에서도 계속 살아남는다 (피할 수 있는 간격 보장)", () => {
    for (const fps of [60, 120, 30]) {
      for (let seed = 1; seed <= 5; seed++) {
        let s = running(seed);
        const totalFrames = 90 * fps; // 90초: 상한 속도 도달 이후까지
        for (let i = 0; i < totalFrames && s.status === "running"; i++) {
          const next = s.obstacles.find((o) => o.x + o.width > PLAYER.x);
          if (next) {
            const distanceToObstacle = next.x - (PLAYER.x + PLAYER.width);
            // 장애물 앞면이 약 0.12초 뒤 도착할 때 점프
            if (distanceToObstacle <= s.speed * 0.12) s = jump(s);
          }
          s = advance(s, 1 / fps, i);
        }
        expect({ fps, seed, status: s.status }).toEqual({ fps, seed, status: "running" });
        expect(s.speed).toBe(SPEED.max);
      }
    }
  });

  it("점프하지 않으면 결국 장애물에 부딪힌다 (위 시뮬레이션의 대조군)", () => {
    const s = simulate(running(1), 10, 60);
    expect(s.status).toBe("over");
  });
});
