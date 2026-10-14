import { describe, expect, it } from "vitest";
import { arrowKeyToDirection, getSwipeDirection, isInteractiveTarget, isSpaceKey, SWIPE_THRESHOLD_PX } from "./input";

describe("getSwipeDirection", () => {
  it("임계값 미만의 이동은 무시한다", () => {
    expect(getSwipeDirection(SWIPE_THRESHOLD_PX - 1, 0)).toBeNull();
    expect(getSwipeDirection(10, -20)).toBeNull();
  });

  it.each([
    [40, 5, "right"],
    [-40, 5, "left"],
    [5, 40, "down"],
    [5, -40, "up"],
    [50, -30, "right"],
    [-20, -60, "up"],
  ] as const)("dx=%i, dy=%i -> %s", (dx, dy, expected) => {
    expect(getSwipeDirection(dx, dy)).toBe(expected);
  });
});

describe("키 매핑", () => {
  it("방향키를 방향으로 변환한다", () => {
    expect(arrowKeyToDirection("ArrowLeft")).toBe("left");
    expect(arrowKeyToDirection("ArrowDown")).toBe("down");
    expect(arrowKeyToDirection("a")).toBeNull();
  });

  it("스페이스 판정", () => {
    expect(isSpaceKey({ key: " ", code: "Space" })).toBe(true);
    expect(isSpaceKey({ key: "Enter", code: "Enter" })).toBe(false);
  });
});

describe("isInteractiveTarget", () => {
  it("버튼·링크 안쪽 요소는 true", () => {
    const button = document.createElement("button");
    const span = document.createElement("span");
    button.appendChild(span);
    expect(isInteractiveTarget(button)).toBe(true);
    expect(isInteractiveTarget(span)).toBe(true);
    const link = document.createElement("a");
    link.href = "/";
    expect(isInteractiveTarget(link)).toBe(true);
  });

  it("일반 요소나 null은 false", () => {
    expect(isInteractiveTarget(document.createElement("div"))).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
    expect(isInteractiveTarget(window)).toBe(false);
  });
});
