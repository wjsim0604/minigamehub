import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // 일부 테스트는 localStorage를 의도적으로 망가뜨림
  }
});
