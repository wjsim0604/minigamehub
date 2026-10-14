/**
 * 게임 공통 입력 유틸 (게임 간 직접 import 금지 원칙에 따라 공용 모듈로 둠).
 */

export type SwipeDirection = "up" | "down" | "left" | "right";

/** 이 거리(px) 미만의 터치 이동은 스와이프로 보지 않는다 (FR-003) */
export const SWIPE_THRESHOLD_PX = 30;

/** 터치 이동량으로 스와이프 방향을 판정한다. 임계값 미만이면 null. */
export function getSwipeDirection(dx: number, dy: number, threshold: number = SWIPE_THRESHOLD_PX): SwipeDirection | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < threshold) return null;
  if (absX > absY) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

const ARROW_KEYS: Record<string, SwipeDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function arrowKeyToDirection(key: string): SwipeDirection | null {
  return ARROW_KEYS[key] ?? null;
}

export function isSpaceKey(event: Pick<KeyboardEvent, "key" | "code">): boolean {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}

/**
 * 버튼·링크·입력 요소에 포커스가 있을 때 스페이스/엔터는 해당 요소의 기본 동작(클릭)에 맡긴다.
 * 그렇지 않으면 게임 입력과 버튼 클릭이 두 번 처리될 수 있다.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return target.closest("button, a[href], input, select, textarea, [contenteditable='true']") !== null;
}
