import { PLAYER, WORLD, type JumpState } from "./logic";

const COLORS = {
  sky: "#dff1ff",
  ground: "#8ce99a",
  groundLine: "#2b8a3e",
  player: "#3b5bdb",
  playerEye: "#ffffff",
  obstacle: "#e8590c",
} as const;

/**
 * 현재 상태를 canvas에 그린다. 캐릭터·장애물은 단순 도형(자체 제작)으로만 그린다.
 * canvas 실제 크기와 논리 해상도(WORLD)가 다르면 비율에 맞춰 늘려 그린다.
 */
export function drawJumpGame(
  ctx: CanvasRenderingContext2D,
  state: JumpState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  // 가로 기준으로 확대하고, 세로 비율이 다른 경우(모바일) 하늘 영역만 늘려 지면은 아래쪽에 고정
  const scale = canvasWidth / WORLD.width;
  const groundY = canvasHeight - (WORLD.height - WORLD.groundY) * scale;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 지면
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
  ctx.fillStyle = COLORS.groundLine;
  ctx.fillRect(0, groundY - 1 * scale, canvasWidth, 2 * scale);

  // 지면 무늬 (이동감)
  const stripe = 40;
  const offset = state.distance % stripe;
  ctx.fillStyle = COLORS.groundLine;
  for (let x = -offset; x < WORLD.width; x += stripe) {
    ctx.fillRect(x * scale, groundY + 8 * scale, 12 * scale, 2 * scale);
  }

  // 장애물
  ctx.fillStyle = COLORS.obstacle;
  for (const o of state.obstacles) {
    ctx.fillRect(o.x * scale, groundY - o.height * scale, o.width * scale, o.height * scale);
  }

  // 캐릭터
  const px = PLAYER.x * scale;
  const py = groundY - (state.playerY + PLAYER.height) * scale;
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(px, py, PLAYER.width * scale, PLAYER.height * scale);
  ctx.fillStyle = COLORS.playerEye;
  ctx.fillRect(px + (PLAYER.width - 9) * scale, py + 7 * scale, 5 * scale, 5 * scale);
}
