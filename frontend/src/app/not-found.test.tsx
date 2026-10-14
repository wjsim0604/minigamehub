import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("404 화면", () => {
  it("안내 문구와 홈 이동 링크를 표시한다", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "게임을 찾을 수 없습니다" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "홈으로" }).getAttribute("href")).toBe("/");
  });
});
