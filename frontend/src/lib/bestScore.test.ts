import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetBestScoreSessionForTests,
  bestScoreKey,
  parseStoredScore,
  readBestScore,
  recordScore,
  subscribeBestScore,
} from "./bestScore";

beforeEach(() => {
  __resetBestScoreSessionForTests();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bestScoreKey", () => {
  it("mgh:{gameId}:bestScore 형식", () => {
    expect(bestScoreKey("2048")).toBe("mgh:2048:bestScore");
    expect(bestScoreKey("jump")).toBe("mgh:jump:bestScore");
  });
});

describe("parseStoredScore", () => {
  it.each([
    [null, 0],
    ["", 0],
    ["abc", 0],
    ["-5", 0],
    ["12.5", 0],
    ["NaN", 0],
    ["Infinity", 0],
    ["1e5", 0],
    ["99999999999999999999", 0],
    ["0", 0],
    ["42", 42],
    [" 42 ", 42],
  ])("%j -> %i", (raw, expected) => {
    expect(parseStoredScore(raw)).toBe(expected);
  });
});

describe("readBestScore / recordScore", () => {
  it("저장된 값이 없으면 0", () => {
    expect(readBestScore("2048")).toBe(0);
  });

  it("더 높은 점수만 저장하고 최고 기록 여부를 알려준다", () => {
    expect(recordScore("2048", 100)).toEqual({ bestScore: 100, isNewBest: true });
    expect(window.localStorage.getItem("mgh:2048:bestScore")).toBe("100");
    expect(recordScore("2048", 50)).toEqual({ bestScore: 100, isNewBest: false });
    expect(recordScore("2048", 100)).toEqual({ bestScore: 100, isNewBest: false });
    expect(recordScore("2048", 101)).toEqual({ bestScore: 101, isNewBest: true });
    expect(readBestScore("2048")).toBe(101);
  });

  it("점수 0은 최고 기록이 아니다", () => {
    expect(recordScore("jump", 0)).toEqual({ bestScore: 0, isNewBest: false });
  });

  it("게임별로 분리 저장된다", () => {
    recordScore("2048", 300);
    recordScore("jump", 70);
    expect(readBestScore("2048")).toBe(300);
    expect(readBestScore("jump")).toBe(70);
  });

  it("소수·음수·비정상 점수는 정규화한다", () => {
    expect(recordScore("jump", 12.9).bestScore).toBe(12);
    expect(recordScore("jump", -5).bestScore).toBe(12);
    expect(recordScore("jump", Number.NaN).bestScore).toBe(12);
  });

  it("손상된 값은 0으로 간주하고 덮어쓴다", () => {
    window.localStorage.setItem("mgh:2048:bestScore", "{corrupted");
    expect(readBestScore("2048")).toBe(0);
    expect(recordScore("2048", 0).isNewBest).toBe(false);
    expect(window.localStorage.getItem("mgh:2048:bestScore")).toBe("0");
    expect(recordScore("2048", 10)).toEqual({ bestScore: 10, isNewBest: true });
    expect(window.localStorage.getItem("mgh:2048:bestScore")).toBe("10");
  });

  it("localStorage 접근이 예외를 던져도 세션 동안 값을 유지한다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readBestScore("2048")).toBe(0);
    expect(recordScore("2048", 500)).toEqual({ bestScore: 500, isNewBest: true });
    expect(readBestScore("2048")).toBe(500);
    expect(recordScore("2048", 400)).toEqual({ bestScore: 500, isNewBest: false });
  });

  it("용량 초과(setItem 실패) 시 오류 없이 세션 값만 유지한다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => recordScore("jump", 30)).not.toThrow();
    expect(readBestScore("jump")).toBe(30);
  });

  it("window.localStorage 자체에 접근할 수 없어도 동작한다", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(readBestScore("jump")).toBe(0);
      expect(recordScore("jump", 9)).toEqual({ bestScore: 9, isNewBest: true });
      expect(readBestScore("jump")).toBe(9);
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });
});

describe("subscribeBestScore", () => {
  it("최고 점수가 갱신되면 구독자에게 알린다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBestScore(listener);
    recordScore("2048", 10);
    expect(listener).toHaveBeenCalledTimes(1);
    recordScore("2048", 5);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    recordScore("2048", 20);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("다른 탭의 storage 이벤트에도 반응한다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBestScore(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "mgh:jump:bestScore" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
