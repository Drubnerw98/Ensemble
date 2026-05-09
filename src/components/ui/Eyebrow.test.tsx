import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders children", () => {
    render(<Eyebrow>Session code</Eyebrow>);
    expect(screen.getByText("Session code")).toBeInTheDocument();
  });

  it("appends count suffix when count is provided", () => {
    render(<Eyebrow count={3}>Candidates</Eyebrow>);
    expect(screen.getByText(/Candidates/)).toBeInTheDocument();
    expect(screen.getByText(/· 3/)).toBeInTheDocument();
  });

  it("does not render count suffix when count is undefined", () => {
    const { container } = render(<Eyebrow>Session code</Eyebrow>);
    expect(container.textContent).not.toMatch(/·/);
  });

  it("applies tracked-uppercase mono styling", () => {
    const { container } = render(<Eyebrow>label</Eyebrow>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/font-display/);
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/tracking-/);
  });
});
