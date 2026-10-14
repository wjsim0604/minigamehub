import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gameLoaders, getGameLoader } from "./loaders";
import { gameRegistry, getGame } from "./registry";

describe("gameRegistry", () => {
  it("MVP 게임 id는 2048, jump (변경 금지)", () => {
    expect(gameRegistry.map((g) => g.id)).toEqual(["2048", "jump"]);
  });

  it("id는 kebab-case이고 중복이 없다", () => {
    const ids = gameRegistry.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("path는 /games/{id} 규칙을 따른다", () => {
    for (const game of gameRegistry) expect(game.path).toBe(`/games/${game.id}`);
  });

  it("이름·설명·썸네일이 비어 있지 않고 썸네일 파일이 존재한다", () => {
    for (const game of gameRegistry) {
      expect(game.name.trim()).not.toBe("");
      expect(game.description.trim()).not.toBe("");
      expect(existsSync(join(process.cwd(), "public", game.thumbnail))).toBe(true);
    }
  });

  it("모든 게임에 지연 로더가 있고, 로더는 컴포넌트를 제공한다", async () => {
    expect(Object.keys(gameLoaders).sort()).toEqual(gameRegistry.map((g) => g.id).sort());
    for (const game of gameRegistry) {
      const load = getGameLoader(game.id);
      expect(load).toBeDefined();
      const mod = await load!();
      expect(typeof mod.default).toBe("function");
    }
    expect(getGameLoader("nope")).toBeUndefined();
    expect(getGameLoader("toString")).toBeUndefined();
  });

  it("getGame", () => {
    expect(getGame("jump")?.name).toBe("점프 게임");
    expect(getGame("nope")).toBeUndefined();
  });
});
