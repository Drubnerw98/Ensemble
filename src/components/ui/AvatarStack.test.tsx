import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AvatarStack } from "./AvatarStack";

const userInfo = new Map<string, { name?: string; avatarUrl?: string }>([
  ["u1", { name: "Alice", avatarUrl: "https://example.com/a.png" }],
  ["u2", { name: "Bob", avatarUrl: "https://example.com/b.png" }],
  ["u3", { name: "Carol", avatarUrl: "https://example.com/c.png" }],
  ["u4", { name: "Dan", avatarUrl: "https://example.com/d.png" }],
]);

describe("AvatarStack", () => {
  it("renders nothing when userIds is empty", () => {
    const { container } = render(
      <AvatarStack userIds={[]} userInfoById={userInfo} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders up to max avatars (default 3)", () => {
    const { container } = render(
      <AvatarStack
        userIds={["u1", "u2", "u3", "u4"]}
        userInfoById={userInfo}
      />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(3);
  });

  it("respects custom max", () => {
    const { container } = render(
      <AvatarStack
        userIds={["u1", "u2", "u3", "u4"]}
        userInfoById={userInfo}
        max={2}
      />,
    );
    expect(container.querySelectorAll("img").length).toBe(2);
  });

  it("renders count when showCount is true", () => {
    render(
      <AvatarStack
        userIds={["u1", "u2", "u3", "u4"]}
        userInfoById={userInfo}
        showCount
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("does not render count when showCount is false", () => {
    const { container } = render(
      <AvatarStack userIds={["u1", "u2", "u3"]} userInfoById={userInfo} />,
    );
    expect(container.textContent).toBe("");
  });

  it("highlight prop adds saffron ring class", () => {
    const { container } = render(
      <AvatarStack userIds={["u1"]} userInfoById={userInfo} highlight />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/ring-/);
    expect(root.className).toMatch(/ring-accent/);
  });

  it("size md uses larger avatar dimensions than sm", () => {
    const { container, rerender } = render(
      <AvatarStack userIds={["u1"]} userInfoById={userInfo} size="sm" />,
    );
    const smCls = (container.querySelector("img") as HTMLElement).className;
    rerender(
      <AvatarStack userIds={["u1"]} userInfoById={userInfo} size="md" />,
    );
    const mdCls = (container.querySelector("img") as HTMLElement).className;
    expect(smCls).not.toBe(mdCls);
  });

  it("falls back to muted circle when avatar URL is missing", () => {
    const partial = new Map([["u1", { name: "NoAvatar" }]]);
    const { container } = render(
      <AvatarStack userIds={["u1"]} userInfoById={partial} />,
    );
    expect(container.querySelector("img")).toBeNull();
    // Fallback is a span with bg-white/10
    const fallback = container.querySelector("span[title='NoAvatar']");
    expect(fallback).not.toBeNull();
  });

  it("uses name as title attribute on avatar", () => {
    const { container } = render(
      <AvatarStack userIds={["u1"]} userInfoById={userInfo} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("title")).toBe("Alice");
  });

  it("uses inline-flex on the wrapper so ring sizes to content (crush bug regression)", () => {
    const userInfoById = new Map([
      ["u1", { name: "Alice", avatarUrl: undefined }],
      ["u2", { name: "Bob", avatarUrl: undefined }],
      ["u3", { name: "Carol", avatarUrl: undefined }],
    ]);
    const { container } = render(
      <AvatarStack
        userIds={["u1", "u2", "u3"]}
        userInfoById={userInfoById}
        max={3}
        size="md"
        highlight
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    // inline-flex sizes to content; plain `flex` would stretch in a block
    // parent and the ring would trace the full container width.
    expect(wrapper?.className).toContain("inline-flex");
    expect(wrapper?.className).not.toMatch(/(?<!inline-)flex /);
  });
});
