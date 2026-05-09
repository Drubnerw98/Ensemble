import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <p>body content</p>
      </Card>,
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("applies surface, border, padding classes", () => {
    const { container } = render(
      <Card>
        <p>x</p>
      </Card>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/bg-surface/);
    expect(root.className).toMatch(/border-border/);
    expect(root.className).toMatch(/rounded-lg/);
    expect(root.className).toMatch(/p-5/);
  });

  it("Card.Eyebrow renders an Eyebrow", () => {
    render(
      <Card>
        <Card.Eyebrow>Session code</Card.Eyebrow>
      </Card>,
    );
    expect(screen.getByText("Session code")).toBeInTheDocument();
  });

  it("Card.Eyebrow forwards count", () => {
    render(
      <Card>
        <Card.Eyebrow count={5}>Candidates</Card.Eyebrow>
      </Card>,
    );
    expect(screen.getByText(/· 5/)).toBeInTheDocument();
  });

  it("Card.Body wraps children", () => {
    render(
      <Card>
        <Card.Body>
          <p>inside body</p>
        </Card.Body>
      </Card>,
    );
    expect(screen.getByText("inside body")).toBeInTheDocument();
  });
});
