import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Create session</Button>);
    expect(
      screen.getByRole("button", { name: "Create session" }),
    ).toBeInTheDocument();
  });

  it("defaults to secondary variant and md size", () => {
    const { container } = render(<Button>x</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toMatch(/border-border/);
    expect(btn.className).toMatch(/bg-transparent/);
  });

  it("primary variant uses accent background", () => {
    const { container } = render(<Button variant="primary">x</Button>);
    expect(container.querySelector("button")!.className).toMatch(/bg-accent/);
  });

  it("ghost variant uses muted text and warn-on-hover", () => {
    const { container } = render(<Button variant="ghost">remove</Button>);
    const cls = container.querySelector("button")!.className;
    expect(cls).toMatch(/text-text-muted/);
    expect(cls).toMatch(/hover:text-warn/);
  });

  it("forwards onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("forwards disabled", () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards type attribute", () => {
    render(<Button type="submit">submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("sm size has different padding than md", () => {
    const { container, rerender } = render(<Button size="sm">x</Button>);
    const smCls = container.querySelector("button")!.className;
    rerender(<Button size="md">x</Button>);
    const mdCls = container.querySelector("button")!.className;
    expect(smCls).not.toBe(mdCls);
  });
});
