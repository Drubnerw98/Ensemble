import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("vitest globals work", () => {
    expect(1 + 1).toBe(2);
  });

  it("dom is available", () => {
    const el = document.createElement("div");
    el.textContent = "hello";
    expect(el.textContent).toBe("hello");
  });
});
